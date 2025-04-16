import { Injectable } from '@angular/core';
import {
    Firestore,
    doc,
    getDoc
} from '@angular/fire/firestore';


export interface UserData {
    email: string;
    firstTimeSignIn: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class DatabaseService {
    public userData?: UserData;
    public userUid: string = '';

    constructor(private firestore: Firestore) { }

    public async getUserData() {
        if (this.userUid !== '') {
            const userDocRef = doc(this.firestore, "users", this.userUid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                this.userData = docSnap.data() as UserData;
                return this.userData;
            }
        } else {
            console.error(`No current userUid in server class variables for user ${this.userUid}`)
        }
        return null;
    }
}
