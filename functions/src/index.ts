import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

/*
* This function removes references to the game ID from the users space
*/
exports.endGame = functions.database.ref('/games/{gameId}')
    .onDelete((snapshot, context) => {
        const promises = []
        if (snapshot.hasChild('user1')) {
            promises.push(snapshot.ref.root.child('users').child(snapshot.child('user1').val()).child('game').remove());
        }
        if (snapshot.hasChild('user2')) {
            promises.push(snapshot.ref.root.child('users').child(snapshot.child('user2').val()).child('game').remove());
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
* Updates whose turn it is
*/
exports.checkTurn = functions.database.ref('/games/{gameId}/board/{position}')
    .onUpdate((snapshot, context) => {
        const promises = []

        // set the current "turn" to the other user
        promises.push(snapshot.after.ref.parent.parent.once('value').then(d => {
            console.log(d.child('user1').val());
            if (d.child('user1').val() === context.auth.uid) {
                promises.push(snapshot.after.ref.parent.parent.update({ turn: d.child('user2').val() }));
            } else {
                promises.push(snapshot.after.ref.parent.parent.update({ turn: d.child('user1').val() }));
            }
        }));

        return Promise.all(promises);
    });
