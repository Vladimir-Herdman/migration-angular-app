import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';

@Component({
    selector: 'app-tab_checklist',
    templateUrl: 'tab_checklist.page.html',
    styleUrls: ['tab_checklist.page.scss'],
    standalone: false,
})
export class TabChecklistPage implements AfterViewInit {
    selectedStage = "predeparture";
    page_list?: Array<ElementRef>
    @ViewChild('predeparture') predepDiv!: ElementRef;
    @ViewChild('departure') depDiv!: ElementRef;
    @ViewChild('arrival') arrDiv!: ElementRef;

    constructor() {}

    ngAfterViewInit() {
        this.page_list = [this.predepDiv, this.depDiv, this.arrDiv];
        this.updateViewPage();

        // Insert all the page data
        //TODO: Make method take an object to go through and add to all pages
        //on page initialization
        this.insertToDo("predeparture", "Hey man what up")
    }

    public insertToDo(divName: string, toDoMessage: string) {
        let currentDiv = this.getDiv(divName)?.nativeElement;

        // Insert into current div
        if (currentDiv) {
            //TODO: Call to server for data needed for this task (For now dummy data)
            const dateDue = "11/24/2028";
            const html = `<p>${toDoMessage}<span>${dateDue}<\span></p>`

            // Insert into Given div
            currentDiv.insertAdjacentHTML("beforeend", html);
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
                break;
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

}
