import { Injectable } from '@angular/core';
import {
    Firestore,
    doc,
    getDoc
} from '@angular/fire/firestore';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';


export interface UserData {
    email: string;
}

@Injectable({
    providedIn: 'root'
})
export class DatabaseService {
    public userData?: UserData;
    public userUid: string = '';
    public platform: string = '';
    public isEmulatorDevice!: boolean;
    public backendUrl: string = '';

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

    private async isEmulator() {
        const info = await Device.getInfo();
        return info.isVirtual;
    }

    public async getPlatformBackendUrl() {
        this.platform = Capacitor.getPlatform();
        const isEmulated: boolean = await this.isEmulator();
        switch (this.platform) {
            case 'android':
                if (isEmulated) {
                    return 'http://10.0.2.2:8000';
                }
                return 'http://192.168.44.173:8000';
            //The ios simulator can't access localhost or the android way, so
            //access local ip address, this is Vova's here at time of coding
            // Also use 'uvicorn main:app --reload --host 192.168.44.173 --port 8000'
            // if running for ios
            case 'ios': 
                return 'http://192.168.44.173:8000';
            default:
                return 'http://localhost:8000';
        }
    }
}
