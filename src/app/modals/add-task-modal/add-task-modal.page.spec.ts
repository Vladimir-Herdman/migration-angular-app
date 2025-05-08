import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddTaskModalPage } from './add-task-modal.page';

describe('AddTaskModalPage', () => {
  let component: AddTaskModalPage;
  let fixture: ComponentFixture<AddTaskModalPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AddTaskModalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
