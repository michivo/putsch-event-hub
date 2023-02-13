import config from 'config';
import firebase, { ServiceAccount } from 'firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * This Gist is part of a medium article - read here:
 * https://jamiecurnow.medium.com/using-firestore-with-typescript-65bd2a602945
 */

// Load ServiceAccount data from json and parse to typeof ServiceAccount
const getServiceAccount = (): ServiceAccount => {
    const moveOut = '..';
    const serviceAccountPath = path.join(
        __dirname,
        moveOut,
        moveOut,
        moveOut,
        config.get('serviceAccount')
    );

    const serviceAccountContent = fs.readFileSync(serviceAccountPath, 'utf8');

    return JSON.parse(serviceAccountContent);
};

// Create firebase application based on ServiceAccount of json file
// or in firebase cloud environment from default credentials;
const getFirebaseApp = (): firebase.app.App => {
    const firebaseName = 'data-storage-service';
    try {
        const serviceAccount = getServiceAccount();
        return firebase.initializeApp(
            {
                credential: firebase.credential.cert(serviceAccount),
            },
            firebaseName
        );
    } catch (ex) {
        return firebase.initializeApp(
            {
                credential: firebase.credential.applicationDefault(),
            },
            firebaseName
        );
    }
};

const firestore = getFirebaseApp().firestore();
// When data is saved to db undefined properties will be ignored.
firestore.settings({ ignoreUndefinedProperties: true });

// This helper function pipes your types through a firestore converter
const converter = <T>() => ({
    toFirestore: (data: Partial<T>) => data,
    fromFirestore: (snap: FirebaseFirestore.QueryDocumentSnapshot) =>
        (<unknown>snap.data()) as T,
});

// This helper function exposes a 'typed' version of firestore().collection(collectionPath)
// Pass it a collectionPath string as the path to the collection in firestore
// Pass it a type argument representing the 'type' (schema) of the docs in the collection
const collectionReference = <T>(collectionPath: string) =>
    firestore.collection(collectionPath).withConverter(converter<T>());

export default { collectionReference };
