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
            console.info(".endGame(): game does not exist, doing nothing.")
        }
        return Promise.all(promises);
    });

/*
* Performs processing when a second user joins a game.
*/
exports.joinGame = functions.database.ref('/games/{gameId}/user2')
    .onCreate((snapshot, context) => {
        // set the current "turn" to the second user (guest gets first turn)
        return snapshot.ref.parent.update({turn: context.auth.uid});
    });

/*
* Validate and update whose turn it is
* NOTE: Although this method will still be called, there are now
*       rules in the database that should prevent an out of turn move.
*/
exports.checkTurn = functions.database.ref('/games/{gameId}/board/{position}')
    .onUpdate((snapshot, context) => {
        const promises = []

        // If a user attempts to play out of turn, we push the data the way it was.
        // This causes this function to be called again.  The second time it is called,
        // the context.auth data is undefined, but there should be a better way to tell.
        // What else could I do here to not get stuck in an infinite loop?
        if (context.auth === undefined) {
            return null;
        }

        // set the current "turn" to the other user
        promises.push(snapshot.after.ref.parent.parent.once('value').then(d => {

            // verify that the user playing should be
            if (d.child('turn').val() === context.auth.uid) {
                if (d.child('user1').val() === context.auth.uid) {
                    promises.push(snapshot.after.ref.parent.parent.update({ turn: d.child('user2').val() }));
                } else {
                    promises.push(snapshot.after.ref.parent.parent.update({ turn: d.child('user1').val() }));
                }
            } else {
                // set it back to the previous value
                promises.push(snapshot.after.ref.set(snapshot.before.val()));
            }
        }));

        return Promise.all(promises);
    });

/*
* Check for a Win or Draw
*/
exports.checkWin = functions.database.ref('/games/{gameId}/board/{position}')
    .onUpdate((snapshot, context) => {
        const promises = []
        promises.push(snapshot.after.ref.parent.once('value').then(b => {
            let win = false; 
            const board = b.val();

            // BRUTE FORCE CHECK OF THE ENTIRE BOARD.  This could be optimized
            // to only check neighbors of $position
            // check for a horizontal win
            if (board[0] === board[1] && board [1] === board[2] && board[0] !== "") {
                win = true;
            } else if (board[3] === board[4] && board [4] === board[5] && board[3] !== "") {
                win = true;
            } else if (board[6] === board[7] && board [7] === board[8] && board[6] !== "") {
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

            if (win) {
                // delete turn, so that nobody can play
                promises.push(snapshot.after.ref.parent.parent.child('turn').remove())

                // add winner
                promises.push(snapshot.after.ref.parent.parent.child('winner').set(context.auth.uid));
            }
        }));

        return Promise.all(promises);
    });


