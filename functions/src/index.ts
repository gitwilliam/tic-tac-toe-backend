import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

/*
* This function removes references to the game ID from the users space
*/
exports.endGame = functions.database.ref('/games/{gameId}')
    .onDelete((snapshot, context) => {
        const promises = []
        if (snapshot.exists()) {
            if (snapshot.hasChild('user1')) {
                promises.push(snapshot.ref.root.child('users').child(snapshot.child('user1').val()).child('game').remove());
            }
            if (snapshot.hasChild('user2')) {
                promises.push(snapshot.ref.root.child('users').child(snapshot.child('user2').val()).child('game').remove());
            }
        } else {
            console.info("endGame(): game does not exist, doing nothing.")
        }
        return Promise.all(promises);
    });

/*
* Performs processing when a second user joins a game.
*/
exports.joinGame = functions.database.ref('/games/{gameId}/user2')
    .onCreate((snapshot, context) => {
        if (snapshot.val() === "bot") {
            // set user2 to bot
            return snapshot.ref.parent.update({ turn: "bot" })
        }
        // set the current "turn" to the second user (guest gets first turn)
        return snapshot.ref.parent.update({turn: context.auth.uid});
    });

/*
* Update whose turn it is
*/
exports.checkTurnAndWin = functions.database.ref('/games/{gameId}/board/{position}')
    .onUpdate((snapshot, context) => {
        const promises = []
        promises.push(checkWin(snapshot, context).then(_ => {
            promises.push(checkTurn(snapshot, context));
        })
        .catch(e => console.error(e)));

        return promises;
    });

export function checkTurn(snapshot, context) {
    const promises = []
    // set the current "turn" to the other user
    promises.push(snapshot.after.ref.parent.parent.once('value').then(d => {

        // if it is a bot game
        if (d.child('user2').exists() && d.child('user2').val() === "bot") {
            if (d.child('turn').exists() && d.child('turn').val() === "bot") {
                promises.push(snapshot.after.ref.parent.parent.update({ turn: d.child('user1').val() }));
            } else {
                promises.push(snapshot.after.ref.parent.parent.update({ turn: d.child('user2').val() }));
            }
        }

        // verify that the user playing should be
        else if (d.child('turn').exists() && d.child('turn').val() === context.auth.uid) {
            if (d.child('user1').val() === context.auth.uid) {
                promises.push(snapshot.after.ref.parent.parent.update({ turn: d.child('user2').val() }));
            } else {
                promises.push(snapshot.after.ref.parent.parent.update({ turn: d.child('user1').val() }));
            }
        } else {
            console.error("checkTurn: a user was able to try and move out of turn.");
        }
    }));

    return Promise.all(promises);
}

/*
* Check for a Win/Loss
*/
export function checkWin(snapshot, context) {
    const promises = []
    promises.push(snapshot.after.ref.parent.parent.once('value').then(g => {
        let win = false;
        const board = g.child('board').val();

        // BRUTE FORCE CHECK OF THE ENTIRE BOARD.  This could be optimized
        // to only check neighbors of $position
        // check for a horizontal win
        if (board[0] === board[1] && board[1] === board[2] && board[0] !== "") {
            win = true;
        } else if (board[3] === board[4] && board[4] === board[5] && board[3] !== "") {
            win = true;
        } else if (board[6] === board[7] && board[7] === board[8] && board[6] !== "") {
            win = true;

            // check for a veritcal win
        } else if (board[0] === board[3] && board[3] === board[6] && board[0] !== "") {
            win = true;
        } else if (board[1] === board[4] && board[4] === board[7] && board[1] !== "") {
            win = true;
        } else if (board[2] === board[5] && board[5] === board[8] && board[2] !== "") {
            win = true;

            // check for a diagonal win
        } else if (board[0] === board[4] && board[4] === board[8] && board[0] !== "") {
            win = true;
        } else if (board[2] === board[4] && board[4] === board[6] && board[2] !== "") {
            win = true;
        }

        let cat = !win;
        if (cat) {
            // check for Cat's Scratch
            board.forEach(element => {
                if (element === "") {
                    cat = false;
                }
            });
        }

        if (win || cat) {
            // who played last?
            const last = g.child('turn').val();

            // delete turn, so that nobody can play
            promises.push(snapshot.after.ref.parent.parent.child('turn').remove());

            // add winner
            if (cat) {
                promises.push(snapshot.after.ref.parent.parent.child('winner').set('cat'));
            } else {
                promises.push(snapshot.after.ref.parent.parent.child('winner').set(last));
            }
        }
    }));

    return Promise.all(promises);
}

/*
* Play for Bot
*/
exports.playBotUpdate = functions.database.ref('/games/{gameId}/turn')
    .onUpdate((snapshot, context) => {
        if (snapshot.after.val() === "bot") {
            return playBot(snapshot, context, snapshot.after.ref.parent.child('board'));
        }
        return Promise.resolve();
    })

exports.playBotCreate = functions.database.ref('/games/{gameId}/turn')
    .onCreate((snapshot, context) => {
        if (snapshot.val() === "bot") {
            return playBot(snapshot, context, snapshot.ref.parent.child('board'));
        }

        return Promise.resolve();
    })

/*
* Bot just picks random play, nothing 'smart' about it
*/
function playBot(snapshot, context, board) {
    const promises = []
    promises.push(board.once('value').then(b => {
        const availablePlays = [];
        const bVal = b.val()

        let index = 0;
        bVal.forEach(element => {
            if (element === "") {
                availablePlays.push(index);
            }
            index++;
        });

        if (availablePlays.length > 0) {
            const play = availablePlays[Math.floor(Math.random() * (availablePlays.length - 1))]
            if (bVal[play] === "") {
                promises.push(board.child(play).set("X"));
            }
        }
    }))

    return Promise.all(promises);
}
