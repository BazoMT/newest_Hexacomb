var express = require("express");
var http = require("http");
const websocket = require("ws");

var port = process.argv[2];
var app = express();

app.use(express.static(__dirname + "/public"));

const server = http.createServer(app);

/* GET home page */
app.get("/", function(req, res) {
    res.sendFile("splash.html", { root: "./public" });
});

/* Pressing the 'PLAY' button, returns this page */
app.get("/play", function(req, res) {
    res.sendFile("game.html", { root: "./public" });
});

/* Pressing the 'Rules' button, returns this page */
app.get("/rules", function(req, res) {
    res.sendFile("rules.html", { root: "./public" });
});


/*Sets up a websocket for the server*/
const wss = new websocket.Server({ server });


/* when a connection is made, wait 2000 ms and then send message*/
wss.on("connection", function connection(ws) {
    let con = ws;
    con.id = connectionID++;
    let playerType = currentGame.addPlayer(con);
    websockets[con.id] = currentGame;

    console.log(
        "Player %s placed in game %s as %s",
        con.id,
        currentGame.id,
        playerType
    );

    con.send(playerType == "A" ? messages.S_PLAYER_A : messages.S_PLAYER_B);

    if (currentGame.hasTwoConnectedPlayers()) {
        currentGame = new Game(gameStatus.gamesInitialized++);
    }

    con.on("message", function incoming(message) {
        let oMsg = JSON.parse(message);
    
        let gameObj = websockets[con.id];
        let isPlayerA = gameObj.playerA == con ? true : false;
    
        if (isPlayerA) {
          /*
           * player A can place a stone
           */
          if (oMsg.type == messages.T_TARGET_WORD) {
            gameObj.setWord(oMsg.data);
    
            if (gameObj.hasTwoConnectedPlayers()) {
              gameObj.playerB.send(message);
            }
          }
        } else {
          /*
           * player B can make a guess;
           * this guess is forwarded to A
           */
          if (oMsg.type == messages.T_MAKE_A_GUESS) {
            gameObj.playerA.send(message);
            gameObj.setStatus("CHAR GUESSED");
          }
    
          /*
           * player B can state who won/lost
           */
          if (oMsg.type == messages.T_GAME_WON_BY) {
            gameObj.setStatus(oMsg.data);
            //game was won by somebody, update statistics
            gameStatus.gamesCompleted++;
          }
        }
    });

    con.on("close", function(code) {
        /*
         * code 1001 means almost always closing initiated by the client;
         * source: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
         */
        console.log(con.id + " disconnected ...");
    
        if (code == "1001") {
          /*
           * if possible, abort the game; if not, the game is already completed
           */
          let gameObj = websockets[con.id];
    
          if (gameObj.isValidTransition(gameObj.gameState, "ABORTED")) {
            gameObj.setStatus("ABORTED");
            gameStatus.gamesAborted++;
    
            /*
             * determine whose connection remains open;
             * close it
             */
            try {
              gameObj.playerA.close();
              gameObj.playerA = null;
            } catch (e) {
              console.log("Player A closing: " + e);
            }
    
            try {
              gameObj.playerB.close();
              gameObj.playerB = null;
            } catch (e) {
              console.log("Player B closing: " + e);
            }
          }
        }
    });
});

server.listen(port);

