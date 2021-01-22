let clickSound = new Audio("../data/click.wav");
let timer = null

function GameState(socket, board, sb){
    this.playerType = null;  
    this.statusBar = sb;
    this.yellows = new Array();
    this.blacks = new Array();

    this.getPlayerType = function () {
        return this.playerType;
    };
    
    this.setPlayerType = function (p) {
        return this.playerType = p;
    }

    this.board = board;

    this.rows = board.children;

    this.initialize = function(){
        let rows = this.rows;
        for(var i = 0; i < rows.length; i++){
            rows[i].id = "Row " + (rows.length-i);
            let buttonsInRow = rows[i].children;
            for(var j = 0; j < buttonsInRow.length; j++){
                let idNew = (j + 1) + "," + (rows.length-i);
                buttonsInRow[j].id = idNew;
            }
        }
    }

    this.addEventListeners = function(){
        for(let i = 0; i < this.rows.length; i++){
            let row = this.rows[i].children;
            for(let j = 0; j < this.rows.length; j++){
                let hex = row[j];
                let gameState = this;
                hex.addEventListener("click", function() {
                    gameState.updateGame(hex.id, gameState.getPlayerType())
                });
            }
        }
    }

    this.updateGame = function(id, pushedPlayerType) {
        /*puts a yellow or black stone alternating each turn, disables the div's event listener,
        * and adds the position clicked to yellow's/black's positions list.
        * also checks every other position or array of positions in yellow's/black's stones
        * for a connection, if one is found, then the array is checked again until none are found
        */
        console.log("The player who pushed: " + pushedPlayerType);
        console.log("I happen to be player " + this.playerType);
        let hexagonClicked = document.getElementById(id);
        if(hexagonClicked.disabled){
            return;
        }
        console.log("My ID is " + id + ". I will now disable :)");
        hexagonClicked.disabled = true;
        
        if (pushedPlayerType === "A") {
            let stone = document.createElement("div");
            stone.className = "yellowStone";

            let position = id.split(",") 
            /*splits the id (which is in the format "x,y") by the comma
            into an array, where position[0] = x and position[1] = y.
            this is how we keep track of the stones on the board.*/

            this.yellows.push(position);

            let top = hexagonClicked.children[0]
            hexagonClicked.insertBefore(stone, top);
            clickSound.play();
            //we want the stones to be the first children of the div
            //the following block is temporary, just a proof of concept
            if(this.playerType == pushedPlayerType){
                if(this.yellows.length > 1){
                    checkAllNodesForConnection(this.yellows);
                    if(checkForAWin(this.yellows, true)){
                        stopTimer(timer);
                        //still gotta send the move to black, lol get rekt
                        this.toggleAll(false);
                        var outgoingMsg = Messages.O_STONE_PLACED;
                        outgoingMsg.data = "A";
                        outgoingMsg.position = id;
                        socket.send(JSON.stringify(outgoingMsg));

                        let finalMsg = Messages.O_GAME_WON_BY;
                        finalMsg.data = "A";
                        socket.send(JSON.stringify(finalMsg));
                        this.toggleAll(false);
                        sb.setStatus(Status["gameWon"]);
                        socket.close();
                        this.toggleAll(false);
                    }
                }
                if (sb.getStatus() != Status["gameWon"]) {
                    sb.setStatus(Status["wait"]);
                }
                this.toggleAll(false);
                document.getElementById("yellow").style.background = "url(../images/player_1_wait.png) no-repeat left";
                document.getElementById("black").style.background = "url(../images/player_2_play.png) no-repeat left";
                var outgoingMsg = Messages.O_STONE_PLACED;
                outgoingMsg.data = "A";
                outgoingMsg.position = id;
                socket.send(JSON.stringify(outgoingMsg));
            }

        }  
        else {
            let stone = document.createElement("div");
            stone.className = "blackStone";

            let position = id.split(",") 

            this.blacks.push(position);

            let top = hexagonClicked.children[0]
            hexagonClicked.insertBefore(stone, top);
            clickSound.play();
            if(this.playerType == pushedPlayerType){
                if(this.blacks.length > 1){
                    checkAllNodesForConnection(this.blacks);
                    if(checkForAWin(this.blacks, false)){
                        stopTimer(timer);
                        //still gotta send the message to yellow, lol get rekt
                        this.toggleAll(false);
                        var outgoingMsg = Messages.O_STONE_PLACED;
                        outgoingMsg.data = "B";
                        outgoingMsg.position = id;
                        socket.send(JSON.stringify(outgoingMsg));

                        let finalMsg = Messages.O_GAME_WON_BY;
                        finalMsg.data = "B";
                        socket.send(JSON.stringify(finalMsg));
                        this.toggleAll(false);  
                        sb.setStatus(Status["gameWon"]);      
                        socket.close();
                        this.toggleAll(false);  
                    }
                }
                if (sb.getStatus() != Status["gameWon"]) {
                    sb.setStatus(Status["wait"]);
                }
                this.toggleAll(false);
                document.getElementById("yellow").style.background = "url(../images/player_1_play.png) no-repeat left";
                document.getElementById("black").style.background = "url(../images/player_2_wait.png) no-repeat left";
                var outgoingMsg = Messages.O_STONE_PLACED;
                outgoingMsg.data = "B";
                outgoingMsg.position = id;
                socket.send(JSON.stringify(outgoingMsg));

            }

        }   
    }

    this.toggleAll = function (state){
        /**
         * @param {boolean} state - true means enable all valid hexagons, false means disable all
         * toggles all hexagons that should be able to be clicked between
         * enabled and disabled
         */
         
         state = !state;        //HTMLElement.disabled = true makes an element disabled, so we want
                                //the inverse of state so that true makes all elements enabled
         let rows = this.rows;
         for(let i = 0; i < rows.length; i++){
             let rowChildren = rows[i].children;
             for(let j = 0; j < rowChildren.length; j++){
                 if(rowChildren[j].firstChild.className === "top"){   //checks whether or not there is a stone in this hexagon
                    rowChildren[j].disabled = state;                  //stones are always inserted as the first child of a .hex div
                }
            }
         }
    
    }
}

function startTimer(){
    let minutes = document.querySelector(".minutes");
    let seconds = document.querySelector(".seconds");

    let minutesValue = 0;
    let secondsValue = 0;

    let timer = setInterval(function(){
        secondsValue++;
        if(secondsValue === 60){
            secondsValue = 0;
            minutesValue++;
        }
        let secondsText = secondsValue < 10 ? "0" + secondsValue : secondsValue;
        let minutesText = minutesValue;



        minutes.innerHTML = minutesText;
        seconds.innerHTML = secondsText;
    }, 1000);
    return timer;
}

function stopTimer(timer){
    clearInterval(timer);
}

function StatusBar() {
    this.setStatus = function(status) {
      document.getElementById("statusBar").innerHTML = status;
    };

    this.getStatus = function() {
        return document.getElementById("statusBar").innerHTML;
    }
}


(function setup() {
    var socket = new WebSocket("ws://localhost:3000");

    var sb = new StatusBar();
    let board = document.querySelector(".game-board-divs");
    var gs = new GameState(socket, board, sb);
    gs.initialize();
  
    socket.onmessage = function (event) {
        let incomingMsg = JSON.parse(event.data);
        console.log(incomingMsg);

        if(incomingMsg.type == Messages.T_GAME_ABORTED){
            stopTimer(timer);
            sb.setStatus(Status["aborted"]);
        }

        if(incomingMsg.type == Messages.T_BOTH_READY){
            timer = startTimer();
            if(gs.getPlayerType() == "A"){
                sb.setStatus(Status["takeTurn"]);
                gs.toggleAll(true);
            }
        }

        if (incomingMsg.type == Messages.T_PLAYER_TYPE) {
            gs.setPlayerType(incomingMsg.data);
            gs.addEventListeners();
            gs.toggleAll(false);
            if(gs.getPlayerType() == "B"){
                sb.setStatus(Status["wait"]);
            }
        }
        
        if (incomingMsg.type == Messages.T_STONE_PLACED) {

            gs.toggleAll(true);
            sb.setStatus(Status["takeTurn"]);
            let otherPlayer = gs.getPlayerType() == "A" ? "B" : "A"; 
            if (otherPlayer == "A"){
                document.getElementById("yellow").style.background = "url(../images/player_1_wait.png) no-repeat left";
                document.getElementById("black").style.background = "url(../images/player_2_play.png) no-repeat left";
            } else {
                document.getElementById("yellow").style.background = "url(../images/player_1_play.png) no-repeat left";
                document.getElementById("black").style.background = "url(../images/player_2_wait.png) no-repeat left";
            }
            gs.updateGame(incomingMsg.position, otherPlayer);
        }

        if (incomingMsg.type == Messages.T_GAME_WON_BY) {
            stopTimer(timer);
            gs.toggleAll(false);
            sb.setStatus(Status["gameLost"]);
        }
    };
  
    socket.onopen = function () {
        socket.send("{}");
    };

    //server sends a close event only if the game was aborted from some side
    socket.onclose = function () {
        sb.setStatus(Status["aborted"]);
    };
  
    socket.onerror = function () { };
})();