function main() {
  // station : คลองอ้อมนนท์ บางใหญ่ (ถนนบางกรวย-ไทรน้อย) (station id : 23)
  const stationID = "<Your station water ID>";

  // spreadsheet id
  const ssID = "<Your Google Sheet ID>";

  // line notify token
  const notifyToken = "<Your LINE Notify Access Token>";

  // get date and time
  const { date, time } = getTodayDateTime();

  // get water level
  const { datetime, waterlevel } = getWaterLevel(stationID, date, time);

  Logger.log(`${datetime} : ${waterlevel}`);

  // set data to sheet
  setDataSheet(ssID, datetime, waterlevel);
  
  // get chart
  const chart = getChart(ssID, datetime);

  // create message for line notify
  let message = "\n\n⚠️ แจ้งเตือนระดับน้ำ 🌊" + "\n\nสถานี : คลองอ้อมนนท์บางใหญ่(ถนนบางกรวย-ไทรน้อย)" + "\n\nวันที่/เวลา : " + datetime + "\n\nระดับน้ำ : " + waterlevel + " (ระดับตลิ่ง 1.85)";

  const lastWaterLevel = getLastWaterLevel(ssID);

  // Logger.log(lastWaterLevel)

  if (lastWaterLevel > 0) {
    message += "\n\nเปลี่ยนแปลง : เพิ่มขึ้น " + lastWaterLevel.toFixed(2);
  } else if (lastWaterLevel < 0) {
    message += "\n\nเปลี่ยนแปลง : ลดลง " + Math.abs(lastWaterLevel).toFixed(2);
  } else {
    message += "\n\nเปลี่ยนแปลง : คงที่";
  }
  
  // message and chart image for send to line notify
  const messages = {
    message: message,
    imageFile: chart
  }

  // send to LINE Notify
  sendLineNotify(messages, notifyToken);
}

function getTodayDateTime() {
  const timeZoneOffset = (new Date()).getTimezoneOffset() * 60000;

  const todayTimeZoneOffset = (new Date(Date.now() - timeZoneOffset)).toISOString().slice(0, -1);

  const date = todayTimeZoneOffset.split("T")[0];

  const time = todayTimeZoneOffset.split("T")[1];

  return { date, time };
}

function getWaterLevel(id, date, time) {
  // url : https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_graph?station_type=tele_waterlevel&station_id=23&start_date=2021-09-27&end_date=2021-09-27%2001:00
  // url : http://api2.thaiwater.net:9200/api/v1/thaiwater30/public/waterlevel_graph?station_type=tele_waterlevel&station_id=23&start_date=2021-09-27&end_date=2021-09-27%2001:00
  const waterLevelUrl = `http://api2.thaiwater.net:9200/api/v1/thaiwater30/public/waterlevel_graph?station_type=tele_waterlevel&station_id=${id}&start_date=${date}&end_date=${date}%20${time}`;

  const response = UrlFetchApp.fetch(waterLevelUrl);

  if (response.getResponseCode() === 200) {
    const responseJSON = JSON.parse(response.getContentText());

    const datas = responseJSON.data.graph_data.sort((a, b) => {
      return new Date(b.datetime) - new Date(a.datetime);
    });

    let datetime;
    let waterlevel;

    for (let data of datas) {
      if (data.value) {
        datetime = data.datetime;
        waterlevel = data.value;
        break;
      }
    }

    return { datetime, waterlevel };
  }
}

function setDataSheet(id, datetime, waterlevel) {
  const ss = SpreadsheetApp.openById(id);
  const sheet = ss.getSheetByName("data");

  const lastRow = sheet.getLastRow();

  // set datetime
  sheet.getRange(`A${lastRow + 1}`).setValue(`${datetime}`);

  // set water level
  sheet.getRange(`B${lastRow + 1}`).setValue(waterlevel);

  // set formula to column c
  sheet.getRange(`C${lastRow + 1}`).setFormula(`=B${lastRow + 1} - B${lastRow}`);
}

function getLastWaterLevel(id) {
  const ss = SpreadsheetApp.openById(id);
  const sheet = ss.getSheetByName("data");

  const lastRow = sheet.getLastRow();

  const lastWaterLevel = sheet.getRange(`C${lastRow}`).getValue();

  return lastWaterLevel;
}

function sendLineNotify(messages, accessToken) {
  const lineNotifyEndPoint = "https://notify-api.line.me/api/notify";

  const options = {
    "headers": { "Authorization": "Bearer " + accessToken },
    "method": 'post',
    "payload": messages,
  };

  try {
    UrlFetchApp.fetch(lineNotifyEndPoint, options);
  } catch (error) {
    Logger.log(error.name + "：" + error.message);
    return;
  }
}

function getChart(id, name) {
  const ss = SpreadsheetApp.openById(id);
  const sheet = ss.getSheetByName("data");
  const chart = sheet.getCharts()[0].getBlob().setName(name).getAs("image/png");

  return chart;
}
