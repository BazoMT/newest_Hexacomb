var express = require("express");
var http = require("http");
const websocket = require("ws");

var messages = require("./public/javascripts/messages");

var gameStatus = require("./statTracker");
var Game = require("./game");

var port = process.argv[2];
var app = express();

app.use(express.static(__dirname + "/public"));

app.set('view engine', 'ejs')
app.get('/', function(req, res) {
    res.render('splash.ejs', { playersOnline: gameStatus.playersOnline, gamesCompleted: gameStatus.gamesCompleted, playersWaiting: gameStatus.playersWaiting });
})

/* Pressing the 'PLAY' button, returns this page */
app.get("/play", function(req, res) {
    res.sendFile("game.html", { root: "./public" });
});

/* Pressing the 'Rules' button, returns this page */
app.get("/rules", function(req, res) {
    res.sendFile("rules.html", { root: "./public" });
});


/*Sets up a websocket for the server*/
const server = http.createServer(app);
const wss = new websocket.Server({ server });

var websockets = {}; //property: websocket, value: game

setInterval(function() {
  for (let i in websockets) {
    if (Object.prototype.hasOwnProperty.call(websockets,i)) {
      let gameObj = websockets[i];
      //if the gameObj has a final status, the game is complete/aborted
      if (gameObj.finalStatus != null) {
        delete websockets[i];
      }
    }
  }
}, 50000);

var currentGame = new Game(gameStatus.gamesInitialized++);
var connectionID = 0; //each websocket receives a unique ID

wss.on("connection", function connection(ws) {
    let con = ws;
    con.id = connectionID++;
    let playerType = currentGame.addPlayer(con);
    websockets[con.id] = currentGame;
    let waiting = true;
    gameStatus.playersOnline++;

    if(playerType == "B"){
      waiting = false;
      console.log("Ready to game...");
      let outgoingMsg = messages.S_BOTH_READY;
      currentGame.playerA.send(outgoingMsg);
      con.send(outgoingMsg);
      gameStatus.playersWaiting = 0;
    }
    else{
      gameStatus.playersWaiting = 1;
    }

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
          if (oMsg.type == messages.T_STONE_PLACED && oMsg.data == "A") {
            gameObj.placeStone(true);
    
            if (gameObj.hasTwoConnectedPlayers()) {
                gameObj.playerB.send(message);
                gameObj.setStatus("STONE PLACED");
                console.log("Stone placed, waiting for player B...");
            }
          }

          /*
           * player A can state who won/lost
          */
          if (oMsg.type == messages.T_GAME_WON_BY) {
            gameObj.setStatus(oMsg.data);
            gameObj.playerB.send(message);
            gameObj.playerA.send(messages.T_GAME_ABORTED);
            //game was won by somebody, update statistics
            gameStatus.gamesCompleted++;
          }
        } else {
          /*
           * player B can place a stone
           */
          if (oMsg.type == messages.T_STONE_PLACED && oMsg.data == "B") {
            gameObj.placeStone(false);
            gameObj.playerA.send(message);
            gameObj.setStatus("STONE PLACED");
            console.log("Stone placed, waiting for player A...");
          }
    
          /*
           * player B can state who won/lost
           */
          if (oMsg.type == messages.T_GAME_WON_BY) {
            gameObj.setStatus(oMsg.data);
            gameObj.playerA.send(message);
            gameObj.playerB.send(message.T_GAME_ABORTED);
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
        gameStatus.playersOnline--;

        if (waiting) {
          gameStatus.playersWaiting = 0;
          waiting = false;
        }
    
        if (code == "1001") {
          /*
           * if possible, abort the game; if not, the game is already completed
           */
          let gameObj = websockets[con.id];
    
          if (gameObj.isValidTransition(gameObj.gameState, "ABORTED")) {
            gameObj.setStatus("ABORTED");
            gameStatus.gamesAborted++;
            gameStatus.gamesCompleted++;

            try{
              gameObj.playerA.send(messages.S_GAME_ABORTED);
            }
            catch(e){
              console.log("Player B closed.");
            }

            try{
              gameObj.playerB.send(messages.S_GAME_ABORTED);
            }
            catch(e){
              console.log("Player A closed.");
            }
    
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