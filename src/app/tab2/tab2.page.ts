import { Component } from '@angular/core';
import predep from 'src/Checklists/predepart.json';
import { FormDataService } from 'src/app/tab1/form-data.service';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page {

  formData : any; 

  constructor(private formDataService: FormDataService) {
    console.log("Tab 2");
    // this.formData=  this.formDataService.getForm();
    let x = true;
    let y;
    y = predep.Domestic.default;
    // console.log(y);
    if(x){
      for(let i in predep.Domestic.Children) {
        y.push(predep.Domestic.Children[i]);
      }
    }
    // console.log(y);
    // console.log(this.formData);
  }

  async ngoninit(){
    console.log("init called");
    this.formData = await this.formDataService.getForm().then(() => {console.log(this.formData)})
  }
}
