#%%
import yaml
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHECKLISTS_DIR = os.path.join(BASE_DIR, '..', 'Checklists')

PREDEPART_DATA_PATH = os.path.join(CHECKLISTS_DIR, 'predepart.yaml')
DEPART_DATA_PATH = os.path.join(CHECKLISTS_DIR, 'depart.yaml')
ARRIVE_DATA_PATH = os.path.join(CHECKLISTS_DIR, 'arrive.yaml')


with open(PREDEPART_DATA_PATH, 'r') as f:
    predep = yaml.load(f, Loader=yaml.SafeLoader)

list_shipping = [
    "Packing & Shipping Logistics",
    "Mail & Administrative Tasks",
]

list_property = [
    "Housing: Selling, Buying & Lease Termination (Pre-Departure)",
    "Communication: Phone & Internet (Pre-Departure)"
]

list_travel = [
    "Vehicle: Planning & Prep (Pre-Departure)",
    "Travel Arrangements",
]


for task in predep:
    cat = task['category']
    if(list_shipping.__contains__(cat)):
        task['category'] = "Shipping & Administrative Logistics"
    elif(list_property.__contains__(cat)):
        task['category'] = "Property Management"
    elif(list_travel.__contains__(cat)):
        task['category'] = "Travel Planning"
    elif(cat == "Children: Documentation & Schooling (Pre-Departure)"):
        task['category'] = "Children: Documentation & Schooling"
    elif(cat == "Pets: Documentation & Travel Prep (Pre-Departure)"):
        task['category'] = "Pets: Documentation & Travel Prep"
    elif(cat == "Employment: Notice & Records (Pre-Departure)"):
        task['category'] = "Employment: Notice & Records"
    elif(cat == "Finances & Banking (Pre-Departure)"):
        task['category'] = "Finances & Banking"

# with open('depart.yaml', 'r') as f:
#     dep = yaml.load(f, Loader=yaml.SafeLoader)

with open(ARRIVE_DATA_PATH, 'r') as f:
    arr = yaml.load(f, Loader=yaml.SafeLoader)

list_general = [
"Arrival: Local Communication Setup",
"Arrival: Local Orientation & Essentials",
"Arrival: Local Banking",
"Arrival: Local Transportation",
"Arrival: Employment & Job Search",
]

list_vehicle = [
    "Vehicle: Local Insurance & Registration (Post-Arrival)",
"Arrival: Driver's License & Vehicle Registration",
"Vehicle: Pickup & Import (Post-Arrival)"
]

list_credentials = [
    "Arrival: Local Registration & Embassy",
"Arrival: Initial Insurance Check",

]

list_housing = [
    "Arrival: Confirm Housing",
    "Arrival: Utilities Setup",
    "Arrival: Household Setup & Shopping"
]

for task in arr:
    cat = task['category']
    if(list_general.__contains__(cat)):
        task['category'] = "Getting setup"
    elif(list_housing.__contains__(cat)):
        task['category'] = "Setting up your House"
    elif(list_vehicle.__contains__(cat)):
        task['category'] = "Setting up Vehicle"
    elif(list_credentials.__contains__(cat)):
        task['category'] = "Setting up Credentials"
    elif(cat == "Pets: Pickup & Settling In (Post-Arrival)"):
        task['category'] = "Pets: Pickup & Settling In"
    elif(cat == "Pets: Local Vet & Supplies (Post-Arrival)"):
        task['category'] = "Pets: Local Vet & Supplies"
    elif(cat == "Children: School Enrollment & Settling In (Post-Arrival)"):
        task['category'] = "Children: School Enrollment & Settling In"

with open(PREDEPART_DATA_PATH, 'w') as f:
    yaml.dump(predep, f)

with open(ARRIVE_DATA_PATH, 'w') as f:
    yaml.dump(arr, f)


