* fix the DB DONE
* try dark mode and Language switch for UI (commit before as it might break things)
* change the trip end-date to be 0:00 instead of 23:00 DONE
* allow to store GPS coordinates for a stored stop DONE
* make address editable on stop DONE
* sort entries in route calculations DONE
* when adding a stop, it lists start and stop-1 separately DONE
* when adding a waypoint, it only lists the start DONE
* when adding a stop after an existing one, it should be on the prev end-date, not end-date +1 
* when creating a trip, ask for the start and end addresses DONE
* when adding a waypoint, it does not appear on the list of stops DONE
* clicking on a stop does not center it on the map DONE
* when adding a 2nd stop, calculating the route does not take it into account DONE
* Add URL and description to each stop DONE
* Add backup routine so I can extract to file and restore in case of DB issues DONE
* Make Claude.md file to help comprehension DONE
* restructure Javascript into smaller files DONE
* clicking on the map icon for a stop shows the previous one : looks like an off-by-one error DONE
* change the add stop and add-waypoint buttons to be on the right of a stop card to save vertical space DONE
* allow to edit waypoints DONE
* persist the route distance between stops and display them in the stop card summary after the nights DONE
* when adding a stop between existing locations, it looks like we're not updating the previous-link for the later stop, resulting in the new stop not showing on the stop list DONE
* adding bookmarks seems broken DONE
* Allow editing of activies on a stop DONE


Please implement the feature as discussed above, paying attention to the following:
* create an "Ask AI" button on the home page, which offers the prompt UI. It should suggest what types of actions are possible. If a user wants to edit an existing trip, they should be able to select it from a list to ensure no confusion.
* If possible, I would like the UI to show progress, as Claude AI does: indicate the current step to the user, including a link to the trip detail page at the end.
* take into account the language of the prompt and give status updates in that language
* for small tasks: adding a stop, use Haiku, for creating a trip, use Sonnet
* allow me in ENV settings to cap the max iterations for the agent. default should be 15
* remove delete capabilities for the API endpoints, including from the mcp-server
* have a system prompt which limits the activities to interacting with this app: create trip, suggest activities, add stops, this kind of thing
* capture prompts submitted by users and show them on the "Ask AI" page to give ideas to users, linking the prompt to the related trip
* allow the user to cancel a submission, as I can do with CLaude in VS Code
* add an admin page where prompts can be deleted, to not have incomplete or spammy prompts
