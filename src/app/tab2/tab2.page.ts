import { Component } from '@angular/core';
import predep from 'src/Checklists/predepart.json';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page {

  constructor() {
    let x = true;
    let y;
    y = predep.Domestic.default;
    console.log(y);
    if(x){
      for(let i in predep.Domestic.Children) {
        y.push(predep.Domestic.Children[i]);
      }
    }
    console.log(y);
  }

}
