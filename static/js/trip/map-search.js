// ============================================================================
// Map Search Functions - Google Maps Places Search Integration
// ============================================================================

(function() {
    const App = window.TripApp;

    let searchDebounceTimer = null;
    let currentSearchResults = [];
    let selectedSearchPlace = null;
    let searchMarker = null;

    /**
     * Initialize map search functionality
     */
    function initMapSearch() {
        const searchInput = document.getElementById('mapSearchInput');
        const clearBtn = document.getElementById('mapSearchClearBtn');

        if (!searchInput) return;

        // Debounced search on input
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearBtn.style.display = query ? 'block' : 'none';

            clearTimeout(searchDebounceTimer);

            if (query.length < 2) {
                hideSearchResults();
                return;
            }

            searchDebounceTimer = setTimeout(() => {
                performSearch(query);
            }, 300); // Debounce for 300ms
        });

        // Clear button
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            hideSearchResults();
            selectedSearchPlace = null;
            if (searchMarker) {
                searchMarker.setMap(null);
                searchMarker = null;
            }
        });
    }

    /**
     * Perform a places search
     */
    async function performSearch(query) {
        const loadingEl = document.getElementById('mapSearchLoading');
        const errorEl = document.getElementById('mapSearchError');
        const resultsContainer = document.getElementById('mapSearchResults');

        loadingEl.style.display = 'block';
        resultsContainer.style.display = 'none';
        errorEl.style.display = 'none';

        try {
            const response = await fetch('/api/places/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || t('errors.searchFailed'));
            }

            const data = await response.json();
            currentSearchResults = data.places || [];

            if (currentSearchResults.length === 0) {
                showSearchMessage(t('map.noResultsFound'), 'info');
            } else {
                renderSearchResults(currentSearchResults);
                resultsContainer.style.display = 'block';
            }
        } catch (error) {
            console.error('Search error:', error);
            showSearchMessage(error.message, 'error');
        } finally {
            loadingEl.style.display = 'none';
        }
    }

    /**
     * Render search results to the UI
     */
    function renderSearchResults(places) {
        const resultsList = document.querySelector('.search-results-list');
        if (!resultsList) return;

        resultsList.innerHTML = places.map((place, index) => `
            <div class="search-result-item" data-index="${index}">
                <div class="search-result-content">
                    <div class="search-result-name">${escapeHtml(place.name)}</div>
                    <div class="search-result-address">${escapeHtml(place.formatted_address || '')}</div>
                    ${place.description ? `<div class="search-result-type">${escapeHtml(place.description)}</div>` : ''}
                </div>
                <div class="search-result-actions">
                    <button class="search-result-select-btn btn btn-sm btn-secondary" title="Show on map">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                        </svg>
                    </button>
                    <button class="search-result-add-btn btn btn-sm btn-primary" title="Add to trip">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

        // Add event listeners to result items
        document.querySelectorAll('.search-result-item').forEach(item => {
            const index = parseInt(item.dataset.index);
            const place = places[index];

            // Click anywhere on the result to select and show on map
            item.querySelector('.search-result-content').addEventListener('click', () => {
                selectSearchResult(place, index);
            });

            // Show on map button
            item.querySelector('.search-result-select-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                selectSearchResult(place, index);
            });

            // Add to trip button
            item.querySelector('.search-result-add-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                addSearchResultToTrip(place);
            });
        });
    }

    /**
     * Select a search result and show it on the map
     */
    function selectSearchResult(place, index) {
        if (!App.map) return;

        selectedSearchPlace = place;

        // Update UI - highlight selected result
        document.querySelectorAll('.search-result-item').forEach((item, i) => {
            if (i === index) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });

        // Remove old marker if exists
        if (searchMarker) {
            searchMarker.setMap(null);
        }

        // Add marker for selected place
        const position = {
            lat: place.latitude,
            lng: place.longitude
        };

        const searchIcon = {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#FFA500',
            fillOpacity: 1,
            strokeWeight: 3,
            strokeColor: '#ffffff',
            scale: 10
        };

        searchMarker = new google.maps.Marker({
            position: position,
            map: App.map,
            icon: searchIcon,
            title: place.name,
            animation: google.maps.Animation.DROP
        });

        // Center map on marker
        App.map.setCenter(position);
        App.map.setZoom(14);

        // Open info window
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div style="padding: 8px;">
                    <h3 style="margin: 0 0 8px 0;">${escapeHtml(place.name)}</h3>
                    <p style="margin: 0; color: #6c757d; font-size: 0.9em;">${escapeHtml(place.formatted_address || '')}</p>
                </div>
            `
        });
        infoWindow.open(App.map, searchMarker);
    }

    /**
     * Open add stop modal with pre-filled search result data
     */
    function addSearchResultToTrip(place) {
        if (!place) return;

        // Populate the modal with search result data
        const addressInput = document.getElementById('address');
        const latInput = document.getElementById('latitude');
        const lonInput = document.getElementById('longitude');
        const stopNameInput = document.getElementById('stopName');

        // Set location type to address
        document.querySelector('input[name="locationType"][value="address"]').checked = true;

        // Pre-fill address and coordinates
        addressInput.value = place.formatted_address || place.name;
        latInput.value = place.latitude;
        lonInput.value = place.longitude;

        // Suggest a stop name based on the place name
        if (!stopNameInput.value) {
            stopNameInput.value = place.name;
        }

        // Open the add stop modal
        populateAddStopModal();
        openModal('addStopModal');

        // Scroll to modal or modal's "Add After" field
        setTimeout(() => {
            const addAfterSelect = document.getElementById('addAfterStop');
            if (addAfterSelect) {
                addAfterSelect.focus();
            }
        }, 100);
    }

    /**
     * Hide search results
     */
    function hideSearchResults() {
        const resultsContainer = document.getElementById('mapSearchResults');
        const loadingEl = document.getElementById('mapSearchLoading');
        const errorEl = document.getElementById('mapSearchError');

        if (resultsContainer) resultsContainer.style.display = 'none';
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'none';
    }

    /**
     * Show search message (error or info)
     */
    function showSearchMessage(message, type = 'info') {
        const errorEl = document.getElementById('mapSearchError');
        const resultsContainer = document.getElementById('mapSearchResults');

        if (errorEl) {
            errorEl.textContent = message;
            errorEl.className = `search-error search-${type}`;
            errorEl.style.display = 'block';
        }

        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    }

    // Expose functions on window and TripApp
    window.initMapSearch = initMapSearch;
    App.initMapSearch = initMapSearch;
    App.selectSearchResult = selectSearchResult;
    App.addSearchResultToTrip = addSearchResultToTrip;
})();
