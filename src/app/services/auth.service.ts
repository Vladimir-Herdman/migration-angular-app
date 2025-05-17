import { Injectable } from '@angular/core';
import {
    Auth,
    signInWithEmailAndPassword,
    signInWithPopup,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    GoogleAuthProvider,
} from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { UserData } from './database.service';


@Injectable({ providedIn: 'root'
})
export class AuthService {
    userStartingData: UserData = {
        email: ''
    };
    public registration_info = this.defaultRegistrationInfo();

    public _email_key: string = ''
        public set email_key(email: string) {this._email_key = email;}
        public get email_key(): string {return this._email_key.replace(/[^a-zA-Z0-9]/g, '_');}


    constructor(private auth: Auth, private firestore: Firestore) {}

    public resetRegistrationInfo() {
        this.registration_info = this.defaultRegistrationInfo();
    }

    private defaultRegistrationInfo() {
        return {
            form: {
                email: '',
                password: ''
            },
            agreedToLegal: false
        }
    }

    async register({ email, password }: {email: string, password: string}) {
        try {
            const userCredentials = await createUserWithEmailAndPassword(this.auth, email, password);

            if (userCredentials) {
                // Create their firebase document in the users collection
                const user = userCredentials.user;
                const userDocRef = doc(this.firestore, "users", user.uid);
                this.userStartingData.email = user.email ?? '';
                this.email_key = user.email ?? 'noEmailDetected';
                //NOTE: use {merge: true} as the final argument below to only
                //add/update, not overwrite whole document with setDoc */);
                await setDoc(userDocRef, this.userStartingData);
            }

            return userCredentials;
        } catch (e) {
            return null;
        }
    }

    async login({ email, password }: {email: string, password: string}) {
        try {
            const userCredentials = await signInWithEmailAndPassword(this.auth, email, password);
            return userCredentials;
        } catch (e) {
            return null;
        }
    }

    async loginGoogle() {
        try {
            const provider = new GoogleAuthProvider();
            const userCredentials = await signInWithPopup(this.auth, provider);
            this.email_key = userCredentials.user.email ?? 'noEmailDetected';
            return userCredentials;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    async sendPasswordReset(email: string) {
        try {
           const test = await sendPasswordResetEmail(this.auth, email);
           return true;
        } catch (e) {
            return false;
        }
    }

    logout() {
        return signOut(this.auth);
    }
}
