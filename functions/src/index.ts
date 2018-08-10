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
