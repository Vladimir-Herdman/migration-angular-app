import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import predep from 'src/Checklists/predepart.json';
import depart from 'src/Checklists/depart.json';
import arrive from 'src/Checklists/arrive.json';
import { FormDataService } from 'src/app/tab1/form-data.service';

@Component({
    selector: 'app-tab_checklist',
    templateUrl: 'tab_checklist.page.html',
    styleUrls: ['tab_checklist.page.scss'],
    standalone: false,
})
export class TabChecklistPage implements AfterViewInit {
    formData : any;
    selectedStage = "predeparture";
    page_list?: Array<ElementRef>
    @ViewChild('predeparture') predepDiv!: ElementRef;
    @ViewChild('departure') depDiv!: ElementRef;
    @ViewChild('arrival') arrDiv!: ElementRef;
    preItemList: string[] = [];
    depItemList: string[] = [];
    arrItemList: string[] = [];

    constructor(private formDataService: FormDataService) {}    

    async ngAfterViewInit() {
        // this.formData = await this.formDataService.getForm();
        this.page_list = [this.predepDiv, this.depDiv, this.arrDiv];
        this.updateViewPage();

        //Implements a listener on the formDataService object
        //This means when it's updated the checklist will update as well
        this.formDataService.formData$.subscribe(form => {
            if (form) {
              this.updateList(form);
            }
          });
        
        // Insert all the page data
        //TODO: Make method take an object to go through and add to all pages
        //on page initialization
        // this.insertToDo("predeparture", "Hey man what up")
    }

    public insertToDo(divName: string, toDoMessage: string) {
        // let currentDiv = this.getDiv(divName)?.nativeElement;

        // // Insert into current div
        // if (currentDiv) {
        //     //TODO: Call to server for data needed for this task (For now dummy data)
        //     const dateDue = " - 11/24/2028";
        //     const html = `<p>${toDoMessage}<span>${dateDue}<\span></p>`

        //     // Insert into Given div
        //     currentDiv.insertAdjacentHTML("beforeend", html);
        // }
        if(divName === "predeparture"){
            if(!this.preItemList.includes(toDoMessage)){
            this.preItemList.push(toDoMessage);
            }
        } else if (divName === "departure"){
            if(!this.depItemList.includes(toDoMessage)){
            this.depItemList.push(toDoMessage);
            }
        } else {
            if(!this.arrItemList.includes(toDoMessage)){
            this.arrItemList.push(toDoMessage);
            }
        }
    }

    // On departure select change, change the visible screen
    public handleChange() {
        this.updateViewPage();
    }

    private updateViewPage() {
        for (let page of this.page_list!) {
            if (page.nativeElement.id === this.selectedStage) {
                page.nativeElement.style.display = "block";
                // break;
            } else {
                page.nativeElement.style.display = "none";
            }
        }
    }

    private getDiv(divName: string): ElementRef | null {
        for (let page of this.page_list!) {
            if (page.nativeElement.id === divName) {
                return page;
            }
        }
        return null;
    }

    removePre(item : string){
        const index = this.preItemList.indexOf(item);
        this.preItemList.splice(index,1);
    }
    removeDep(item : string){
        const index = this.depItemList.indexOf(item);
        this.depItemList.splice(index,1);
    }
    removeArr(item : string){
        const index = this.arrItemList.indexOf(item);
        this.arrItemList.splice(index,1);
    }

    public async updateList(form: any){
        this.formData = form;

        //Reset the checklists when we need to regenerate them
        this.arrItemList = new Array();
        this.preItemList = new Array();
        this.depItemList = new Array();

        let x = this.formData.moveType === "international";

        //Domestic or International
        let pre = x ? predep.International : predep.Domestic;
        let dep = x ? depart.International : depart.Domestic;
        let arri = x ? arrive.International : arrive.Domestic;

        /**
         * Predeparture Checklist generation
         */        
        //Default
        pre.default.forEach(item => this.insertToDo("predeparture",item));
        dep.default.forEach(item => this.insertToDo("departure", item));
        arri.default.forEach(item => this.insertToDo("arrival",item));

        //Immigration
        if(x){
            //There is a blank array in domestic to make the code chill out
            pre.Immigration_Documents.forEach(item => this.insertToDo("predeparture",item));
        }
        // Children
        if(this.formData.children === 'true'){
            pre.Children.forEach(item => this.insertToDo("predeparture",item));
            dep.Children.forEach(item => this.insertToDo("departure",item));
            arri.Children.forEach(item => this.insertToDo("arrival",item));
        }
        //Vehicle
        if(this.formData.vehicle === "bring"){
            pre.Vehicle.Bringing.forEach(item => this.insertToDo("predeparture",item));
            arri.Vehicle.Bringing.forEach(item => this.insertToDo("arrival",item));
        }
        if(this.formData.vehicle === "rent"){
            pre.Vehicle.Renting.forEach(item => this.insertToDo("predeparture",item));
            arri.Vehicle.Renting.forEach(item => this.insertToDo("arrival",item));
        }
        //Pets
        if(this.formData.family.pets){
            pre.Pets.forEach(item => this.insertToDo("predeparture",item));
            dep.pets.forEach(item => this.insertToDo("departure",item));
            arri.Pets.forEach(item => this.insertToDo("arrival",item));
        }
        //Phone
        if(this.formData.services.internet){
            pre.Phone.forEach(item => this.insertToDo("predeparture",item));
        }
        //Realtor
        if(this.formData.currentHousing === "own"){
            pre.Realtor.forEach(item => this.insertToDo("predeparture",item));
        }
        //Rent
        if(this.formData.currentHousing === "rent"){
            pre.landlord.forEach(item => this.insertToDo("predeparture",item));
        }
    }

}
