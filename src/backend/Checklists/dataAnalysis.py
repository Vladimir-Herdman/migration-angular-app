# %%
import yaml

with open('predepart.yaml', 'r') as f:
    predep = yaml.load(f, Loader=yaml.SafeLoader)

predep_category = {}

for task in predep:
    cat = task['category']
    if(not predep_category.__contains__(cat)):
        predep_category[cat] = 1
    else:
        predep_category.update({cat: predep_category[cat] + 1})
print(predep_category)

# %%
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

predep_category = {}
a = 0
for task in predep:
    cat = task['category']
    if(not predep_category.__contains__(cat)):
        predep_category[cat] = 1
    else:
        predep_category.update({cat: predep_category[cat] + 1})
print(predep_category)

for i in predep_category:
    a += predep_category[i]
print(a)

print(len(predep_category))

    

# %%
with open('depart.yaml', 'r') as f:
    dep = yaml.load(f, Loader=yaml.SafeLoader)

dep_category = {}

for task in dep:
    cat = task['category']
    if(not dep_category.__contains__(cat)):
        dep_category[cat] = 1
    else:
        dep_category.update({cat: dep_category[cat] + 1})

print(dep_category)

# %%
print(dep_category)
a = 0
for i in dep_category:
    a += dep_category[i]

print(a)
print(len(dep_category))

# %%
with open('arrive.yaml', 'r') as f:
    arr = yaml.load(f, Loader=yaml.SafeLoader)

arr_category = {}

for task in arr:
    cat = task['category']
    if(not arr_category.__contains__(cat)):
        arr_category[cat] = 1
    else:
        arr_category.update({cat: arr_category[cat] + 1})

print(arr_category)

# %%
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

arr_category = {}

for task in arr:
    cat = task['category']
    if(not arr_category.__contains__(cat)):
        arr_category[cat] = 1
    else:
        arr_category.update({cat: arr_category[cat] + 1})

print(arr_category)

a = 0

for i in arr_category:
    a += arr_category[i]

print(a)


# %%
with open('predepart.yaml', 'w') as f:
    yaml.dump(predep, f)

with open('arrive.yaml', 'w') as f:
    yaml.dump(arr, f)


# %%



