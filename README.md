# Delivery AI DAI-025

## Expense Workflow
- Once expenses are saved, the job disappears from the active Expenses page.
- Saved expenses remain permanently attached to the collection.
- Collection History now shows a Saved Expense Record under the job.
- History includes Train, Taxi, Bus, Fuel, Parking, Tolls, Other, Agreed Price, Final Price and Money Saved.
- The expense save date/time is recorded.
- Saved expense details are also synchronised into permanent appraisal archive records.

## Command Centre Fixes
- Travel Costs This Month now totals the job expense records for the selected/current month.
- The tile also shows how many expense records have been saved.
- Vehicle Miles This Month now uses Start Mileage to End Mileage from the collected vehicle journey.
- Legacy duplicate/unused distance fields are no longer used for the Command Centre mileage total.

## Collection History
- Vehicle start mileage
- Vehicle end mileage
- Vehicle miles
- Collector hours
- Travel cost
- Reduction
- Full saved expense breakdown

## Update GitHub
git add .
git commit -m "DAI-025 Save expenses to history and fix command centre totals"
git push
