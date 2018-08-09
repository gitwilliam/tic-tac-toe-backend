import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

/*
* This function removes references to the game ID from the users space
*/
exports.endGame = functions.database.ref('/games/{gameId}')
    .onDelete((snapshot, context) => {
        let promises = []
        if (snapshot.hasChild('user1')) {
            promises.push(snapshot.ref.root.child('users').child(snapshot.child('user1').val()).child('game').remove());
        }
        if (snapshot.hasChild('user2')) {
            promises.push(snapshot.ref.root.child('users').child(snapshot.child('user2').val()).child('game').remove());
        }
        return Promise.all(promises);
    });