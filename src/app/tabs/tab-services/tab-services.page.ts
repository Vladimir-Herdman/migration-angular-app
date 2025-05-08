import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';

interface Service {
    id: string,
    name: string,
    description: string,
    url: string,
}

interface TaskCategory {
  name: string;
  tasks: Service[];
  isExpanded?: boolean;
}

@Component({
    selector: 'app-tab-services',
    templateUrl: './tab-services.page.html',
    styleUrls: ['./tab-services.page.scss'],
    standalone: false,
})
export class TabServicesPage implements OnInit, AfterViewInit {
    public servicesData!: TaskCategory[];

    constructor(
        private changeDetectorRef: ChangeDetectorRef,
    ) { }

    ngOnInit() {
    }

    async ngAfterViewInit() {
        const raw: any[] = await this.readJsonFile('assets/json/services.json');
        this.servicesData = raw.map(group => ({
            name: group.group_id,
            tasks: group.services,
            isExpanded: false,
        }));
        this.changeDetectorRef.detectChanges();
    }

    async readJsonFile(file_path: string) {
        try {
            const response = await fetch(file_path);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Error reading JSON file:", error);
        }
    }

    toggleCategory(category: TaskCategory) {
        category.isExpanded = !category.isExpanded;
        this.changeDetectorRef.detectChanges();
    }

}
