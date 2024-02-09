const five = require("johnny-five"); // johnny-five ライブラリの読み込み
const board = new five.Board({ port: "COM0" }); // Arduino マイコンボードの取得

let led; // LEDオブジェクト
let light; // 光センサオブジェクト
let thermo; // 温度センサオブジェクト
let servo; // サーボオブジェクト

// Arduinoの準備ができたら
board.on("ready", () => {
    // サーボのセットアップ
    servo = new five.Servo({
        pin: 7,
        invert: true // 回転方向を反転させる
    });

    // LEDのセットアップ
    led = new five.Led(2);

    // 温度センサのセットアップ
    thermo = new five.Sensor({
        pin: 4,
        freq: 3000 // 3秒ごとに測定
    });

    // 温度センサの値が計測されたら
    thermo.on("data", () => {
        const v = thermo.value;
        const B = 4275;
        const R0 = 100000;
        const R = (1023 / v - 1) * R0;
        const celsius = 1 / (Math.log(R / R0) / B + 1 / 298.15) - 273.15;
        io.emit("thermoValue", celsius); // 温度データを送信
    });

    // 光センサのセットアップ
    light = new five.Sensor({
        pin: 3,
        freq: 3000 // 3秒ごとに測定
    });

    // 光センサの値が計測されたら
    light.on("data", () => {
        const lightValue = light.value;
        io.emit("lightValue", lightValue); // 光データを送信
    });
});

const ex = require("express"); // Express ライブラリの読み込み
const fs = require("fs"); // ファイルシステムライブラリの読み込み
const app = ex(); // Express アプリケーションの作成
app.use(ex.static(__dirname)); // ドキュメントルートの設定
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html"); // クライアントにindex.htmlを送信
});

const opt = {
    key: fs.readFileSync("../ssl/server.key"), // 秘密鍵の読み込み
    cert: fs.readFileSync("../ssl/server.crt") // 証明書の読み込み
};

const svr = require("https").Server(opt, app); // HTTPSサーバの作成
svr.listen(443); // 443番ポートでリッスン
console.log("サーバ起動（終了はCtrl+C）"); // サーバ起動メッセージの表示

const io = require("socket.io")(svr); // Socket.IOの読み込み
io.on("connection", (socket) => { // ソケット接続があったら
    console.log("ユーザが接続"); // 接続メッセージの表示
    if (!board.isReady) { return; } // Arduinoの準備ができていなければ終了

    // ビデオデータの配信
    socket.on("video", (data) => {
        socket.broadcast.emit("video", data);
    });

    // LED制御
    socket.on("control", (data) => {
        console.log(data);
        if (data.ledOn) {
            led.on();
        } else {
            led.off();
        }
    });

    // 水やり
    socket.on("water", () => {
        console.log("水やりを開始");
        servo.to(90);
        setTimeout(() => {
            console.log("水やり終了");
            servo.to(50);
        }, 5000);
    });
});
