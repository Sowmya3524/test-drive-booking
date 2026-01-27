// Supabase config (fill these with your actual project values)
const SUPABASE_URL = 'https://iawznkckpbufhprkmufc.supabase.co'; // TODO: replace
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhd3pua2NrcGJ1ZmhwcmttdWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2Mzc0MjMsImV4cCI6MjA4MjIxMzQyM30.ce_cyJC18sL6JLnoEKpe6jBx5UZH6VQSmqnxtDrMaXA'; // TODO: replace

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    initializeEventListeners();
    setupHyderabadLocationSuggestions();
    loadCars(); // Load cars from Supabase
    loadAvailabilityTable(); // Load availability table
});

// Initialize all event listeners
function initializeEventListeners() {
    // Simple tab navigation between Booking and Manage Cars
    const tabBooking = document.getElementById('tabBooking');
    const tabManageCars = document.getElementById('tabManageCars');
    if (tabBooking && tabManageCars) {
        tabBooking.addEventListener('click', () => switchMainView('booking'));
        tabManageCars.addEventListener('click', () => switchMainView('manageCars'));
    }

    // Submit Booking button
    const submitBtn = document.getElementById('submitBookingBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitBooking);
    }

    // Add Car button (Manage Cars page)
    const addCarBtn = document.getElementById('addCarBtn');
    if (addCarBtn) {
        addCarBtn.addEventListener('click', submitNewCar);
    }

    // Schedule modal behaviour
    setupScheduleModal();

    // Car selection change - update availability
    const selectedCar = document.getElementById('selectedCar');
    if (selectedCar) {
        selectedCar.addEventListener('change', function() {
            updateCarId();
            // If date is already selected, refresh availability
            const dateInput = document.getElementById('scheduleDateInput');
            if (dateInput && dateInput.value) {
                checkAvailability();
            }
        });
    }

    // When consultant changes, clear any selected schedule and refresh availability for new consultant
    const consultantSelect = document.getElementById('consultantName');
    if (consultantSelect) {
        consultantSelect.addEventListener('change', function () {
            // Clear previously chosen schedule
            const bookingDateInput = document.getElementById('bookingDate');
            const timeSlotInput = document.getElementById('timeSlot');
            const scheduleText = document.getElementById('scheduleDisplayText');
            if (bookingDateInput) bookingDateInput.value = '';
            if (timeSlotInput) timeSlotInput.value = '';
            if (scheduleText) scheduleText.textContent = 'Select schedule';

            // If schedule modal is open and a date is already set, re-run availability for new consultant
            const dateInput = document.getElementById('scheduleDateInput');
            if (dateInput && dateInput.value) {
                checkAvailability();
            }
        });
    }
}

// Switch between booking page and manage cars page
function switchMainView(view) {
    const bookingPage = document.getElementById('bookingPage');
    const manageCarsPage = document.getElementById('manageCarsPage');
    const tabBooking = document.getElementById('tabBooking');
    const tabManageCars = document.getElementById('tabManageCars');

    const showBooking = view === 'booking';

    if (bookingPage) bookingPage.style.display = showBooking ? 'flex' : 'none';
    if (manageCarsPage) manageCarsPage.style.display = showBooking ? 'none' : 'flex';

    if (tabBooking) {
        if (showBooking) {
            tabBooking.classList.add('tab-active');
        } else {
            tabBooking.classList.remove('tab-active');
        }
    }
    if (tabManageCars) {
        if (!showBooking) {
            tabManageCars.classList.add('tab-active');
        } else {
            tabManageCars.classList.remove('tab-active');
        }
    }
}

// Store cars data globally
let carsData = [];

// Load cars from Supabase
async function loadCars() {
    const carSelect = document.getElementById('selectedCar');
    if (!carSelect) return;

    try {
        // Check if URL is valid
        if (!SUPABASE_URL || SUPABASE_URL.includes('TODO') || SUPABASE_URL.includes('your-project')) {
            carSelect.innerHTML = '<option value="">⚠️ Supabase URL not configured. Please update SUPABASE_URL in script.js</option>';
            return;
        }

        // Try with explicit schema first
        const response = await fetch(`${SUPABASE_URL}/rest/v1/cars?select=*&order=car_make,car_model`, {
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Supabase API Error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
                url: `${SUPABASE_URL}/rest/v1/cars`
            });
            
            if (response.status === 404) {
                carSelect.innerHTML = '<option value="">⚠️ Table not found. Check: 1) Table name is "cars" 2) Table is in "public" schema 3) RLS policy allows SELECT</option>';
                return;
            }
            
            if (response.status === 401 || response.status === 403) {
                carSelect.innerHTML = '<option value="">⚠️ Permission denied. Check RLS policy "allow_select_cars_for_anon" exists.</option>';
                return;
            }
            
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        carsData = await response.json();
        
        if (carsData.length === 0) {
            carSelect.innerHTML = '<option value="">No cars available. Please add cars in Supabase.</option>';
            renderManageCarsList();
            return;
        }
        
        // Populate dropdown
        carSelect.innerHTML = '<option value="">Select a car</option>';
        carsData.forEach(car => {
            const option = document.createElement('option');
            option.value = car.id;
            option.textContent = `${car.car_make} ${car.car_model} (${car.car_variant})`;
            carSelect.appendChild(option);
        });
        
        console.log(`✅ Loaded ${carsData.length} cars successfully`);

        // Also render list in Manage Cars page
        renderManageCarsList();
    } catch (err) {
        console.error('Error loading cars:', err);
        
        // Check for specific error types
        if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
            if (err.message.includes('ERR_NAME_NOT_RESOLVED') || err.message.includes('network')) {
                carSelect.innerHTML = '<option value="">⚠️ Network error: Cannot reach Supabase. Check: 1) Internet connection 2) Supabase URL is correct 3) No firewall blocking</option>';
            } else {
                carSelect.innerHTML = '<option value="">⚠️ Connection failed. Check internet connection and Supabase URL.</option>';
            }
        } else if (err.message && err.message.includes('CORS')) {
            carSelect.innerHTML = '<option value="">⚠️ CORS error: Check Supabase project settings and allowed origins.</option>';
        } else {
            carSelect.innerHTML = '<option value="">❌ Error loading cars. Open browser console (F12) for details.</option>';
        }
        
        // Log detailed error for debugging
        console.error('Full error details:', {
            name: err.name,
            message: err.message,
            stack: err.stack,
            supabaseUrl: SUPABASE_URL
        });
    }
}

// Render stacked list of cars in Manage Cars page
function renderManageCarsList() {
    const listEl = document.getElementById('manageCarsList');
    if (!listEl) return;

    if (!carsData || carsData.length === 0) {
        listEl.innerHTML = '<p class="manage-cars-empty">No cars in inventory yet. Add a car above to get started.</p>';
        return;
    }

    listEl.innerHTML = '';

    carsData.forEach((car, index) => {
        const card = document.createElement('div');
        card.className = 'manage-car-card';

        const title = `${car.car_make || ''} ${car.car_model || ''}`.trim() || 'Unnamed car';
        const year = car.year_of_manufacture ? ` • ${car.year_of_manufacture}` : '';

        card.innerHTML = `
            <div class="manage-car-main">
                <div class="manage-car-title">${title}${year}</div>
                <div class="manage-car-subtitle">Variant: ${car.car_variant || '-'}</div>
            </div>
            <div class="manage-car-side">
                <span class="manage-car-chip">Car #${index + 1}</span>
            </div>
        `;

        listEl.appendChild(card);
    });
}

// Update hidden car_id field and car display
function updateCarId() {
    const selectedCar = document.getElementById('selectedCar');
    const carIdInput = document.getElementById('carId');
    if (selectedCar && carIdInput) {
        carIdInput.value = selectedCar.value || '';
        updateCarDisplay(selectedCar.value);
    }
}

// Update car display on right side (currently not used - card removed)
function updateCarDisplay(carId) {
    // Intentionally left minimal. Kept only to avoid errors from existing calls.
    return;
}

// -----------------------------
// Availability Table - Show booked time slots by date and car
// -----------------------------

// All possible time slots
const ALL_TIME_SLOTS = ['09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00'];

// Helper: check if a given slot is already in the past for a given date
function isSlotInPast(dateStr, slot) {
    if (!dateStr || !slot) return false;

    const todayStr = new Date().toISOString().split('T')[0];

    // If the date is before today, it's past
    if (dateStr < todayStr) return true;

    // If the date is after today, it's in the future
    if (dateStr > todayStr) return false;

    // Same day: compare current time with slot END time
    // Example slot: '15:00-17:00' → we allow booking until 17:00.
    const [, endTime] = slot.split('-'); // e.g. '17:00'
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const now = new Date();
    const slotEnd = new Date();
    slotEnd.setHours(endHour, endMinute, 0, 0);

    // If current time is equal or after slot END, treat slot as past
    // (consultants can still book and go out during the slot window).
    return now >= slotEnd;
}

// Load and render availability table
async function loadAvailabilityTable() {
    const loadingEl = document.getElementById('availabilityTableLoading');
    const contentEl = document.getElementById('availabilityTableContent');
    const emptyEl = document.getElementById('availabilityTableEmpty');

    if (!loadingEl || !contentEl || !emptyEl) return;

    loadingEl.style.display = 'block';
    contentEl.style.display = 'none';
    emptyEl.style.display = 'none';

    try {
        // Fetch all upcoming bookings with car details (live test drives list)
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/bookings?booking_date=gte.${today}&select=id,booking_date,time_slot,consultant_name,test_drive_type,customer_location,car_id,cars!inner(car_make,car_model,car_variant)&order=booking_date,time_slot,car_id`,
            {
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch bookings');
        }

        const bookings = await response.json();

        // Render card-style list
        renderAvailabilityTable(bookings);

        loadingEl.style.display = 'none';
        if (!bookings || bookings.length === 0) {
            emptyEl.style.display = 'block';
        } else {
            contentEl.style.display = 'block';
        }
    } catch (err) {
        console.error('Error loading availability table:', err);
        loadingEl.style.display = 'none';
        contentEl.innerHTML = '<p style="color: #fca5a5; text-align: center; padding: 20px;">Error loading availability. Please refresh.</p>';
        contentEl.style.display = 'block';
    }
}

// Render availability as card-style list (similar to "Live Test Drives")
function renderAvailabilityTable(bookings) {
    const contentEl = document.getElementById('availabilityTableContent');
    if (!contentEl) return;

    if (!bookings || bookings.length === 0) {
        contentEl.innerHTML = '';
        return;
    }

    const listContainer = document.createElement('div');
    listContainer.className = 'availability-list';

    // Create cards: one per booking (TD), with serial numbers TD #1, TD #2, ...
    bookings.forEach((booking, index) => {
        if (!booking.cars) return;

        const car = booking.cars;
        const carName = `${car.car_make} ${car.car_model} (${car.car_variant})`;
        const consultant = booking.consultant_name || '—';
        const typeLabel = booking.test_drive_type === 'home' ? 'Home Test Drive' : 'Branch Test Drive';

        const date = new Date(booking.booking_date);
        const dateFormatted = date.toLocaleDateString('en-IN', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });

        const tdNumber = `TD #${index + 1}`;

        const card = document.createElement('div');
        card.className = 'availability-card';
        card.innerHTML = `
            <div class="availability-card-left">
                <div class="availability-car-name">${tdNumber}</div>
                <div class="availability-meta">
                    <span class="availability-meta-item">
                        <span class="availability-meta-label">Car:</span>
                        <span>${carName}</span>
                    </span>
                </div>
                <div class="availability-meta">
                    <span class="availability-meta-item">
                        <span class="availability-meta-label">Date:</span>
                        <span>${dateFormatted}</span>
                    </span>
                    <span class="availability-meta-item">
                        <span class="availability-meta-label">Slot:</span>
                        <span>${booking.time_slot}</span>
                    </span>
                </div>
                <div class="availability-meta">
                    <span class="availability-meta-item">
                        <span class="availability-meta-label">Consultant:</span>
                        <span>${consultant}</span>
                    </span>
                    ${booking.customer_location ? `<span class="availability-meta-item"><span class="availability-meta-label">Location:</span><span>${booking.customer_location}</span></span>` : ''}
                </div>
            </div>
            <div class="availability-card-right">
                <div class="availability-tag">${typeLabel}</div>
                <button type="button" class="btn-end-td" data-booking-id="${booking.id}">End TD</button>
            </div>
        `;

        listContainer.appendChild(card);
    });

    contentEl.innerHTML = '';
    contentEl.appendChild(listContainer);

    // Wire up End TD buttons
    document.querySelectorAll('.btn-end-td').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-booking-id');
            if (id) {
                endTestDrive(Number(id));
            }
        });
    });
}

// End a test drive (delete booking)
async function endTestDrive(bookingId) {
    if (!bookingId) return;

    const confirmed = window.confirm('Are you sure you want to end this test drive?');
    if (!confirmed) return;

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}`, {
            method: 'DELETE',
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!res.ok) {
            const text = await res.text();
            console.error('Error ending test drive:', text);
            alert('Could not end this test drive. Please check console for details (RLS policy might block DELETE).');
            return;
        }

        alert('Test drive ended.');
        loadAvailabilityTable();
    } catch (err) {
        console.error('Unexpected error ending test drive:', err);
        alert('Unexpected error while ending test drive. Please try again.');
    }
}

// -----------------------------
// Hyderabad suggestions using OpenStreetMap (Nominatim) + local list
// -----------------------------

// Base Hyderabad examples to show even before typing
const hyderabadLocations = [
    "Ameerpet, Hyderabad",
    "Ameerpet Metro Station, Hyderabad",
    "Ameerpet Bus Stop, Hyderabad",
    "SR Nagar, Hyderabad",
    "Begumpet, Hyderabad",
    "Punjagutta, Hyderabad",
    "Madhapur, Hyderabad",
    "HiTech City, Hyderabad",
    "Jubilee Hills, Hyderabad",
    "Banjara Hills, Hyderabad",
    "Kukatpally, Hyderabad",
    "KPHB Colony, Hyderabad",
    "Miyapur, Hyderabad",
    "LB Nagar, Hyderabad",
    "Dilsukhnagar, Hyderabad",
    "Secunderabad, Hyderabad",
    "Charminar, Hyderabad",
    "Gachibowli, Hyderabad",
    "Raidurg, Hyderabad",
    "Kondapur, Hyderabad",
    "Himayatnagar, Hyderabad",
    "Kothapet, Hyderabad",
    "Langer House, Hyderabad",
    "Mehdipatnam, Hyderabad",
    "Tolichowki, Hyderabad",
    "Attapur, Hyderabad",
    "Film Nagar, Hyderabad",
    "Manikonda, Hyderabad",
    "Narsingi, Hyderabad"
];

let nominatimTimeoutId = null;

function setupHyderabadLocationSuggestions() {
    const input = document.getElementById('customerLocation');
    if (!input) return;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const list = document.createElement('div');
    list.id = 'locationSuggestions';
    list.style.position = 'absolute';
    list.style.top = '100%';
    list.style.left = '0';
    list.style.right = '0';
    list.style.zIndex = '50';
    list.style.background = 'rgba(15,23,42,0.98)';
    list.style.border = '1px solid rgba(148,163,184,0.7)';
    list.style.borderRadius = '10px';
    list.style.marginTop = '4px';
    list.style.maxHeight = '260px';
    list.style.overflowY = 'auto';
    list.style.display = 'none';
    list.style.boxShadow = '0 18px 40px rgba(15,23,42,0.95)';
    wrapper.appendChild(list);

    const baseSuggestions = [...hyderabadLocations].sort((a, b) =>
        a.localeCompare(b)
    );

    function renderSuggestions(items) {
        list.innerHTML = '';
        items.forEach(loc => {
            const item = document.createElement('div');
            item.textContent = loc;
            item.style.padding = '10px 12px';
            item.style.cursor = 'pointer';
            item.style.fontSize = '0.9rem';
            item.style.color = '#e5ecff';
            item.style.borderBottom = '1px solid rgba(30, 64, 175, 0.45)';

            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(37, 99, 235, 0.3)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'transparent';
            });
            item.addEventListener('click', () => {
                input.value = loc;
                list.style.display = 'none';
            });

            list.appendChild(item);
        });

        if (items.length > 0) {
            list.style.display = 'block';
        } else {
            list.style.display = 'none';
        }
    }

    function showDefaultList() {
        renderSuggestions(baseSuggestions.slice(0, 25));
    }

    // Try to extract a human-readable place name from a Google Maps-style URL
    function extractPlaceNameFromText(text) {
        if (!text) return null;
        const value = text.trim();

        // Match ".../maps/place/<NAME>/@..."
        const placeMatch = value.match(/\/maps\/place\/([^/@]+)/);
        if (placeMatch && placeMatch[1]) {
            try {
                const decoded = decodeURIComponent(placeMatch[1]);
                return decoded.replace(/\+/g, ' ').trim();
            } catch {
                return placeMatch[1].replace(/\+/g, ' ').trim();
            }
        }

        return null;
    }

    // Try to extract coordinates from pasted text (plain "lat, lon" or from common map URLs)
    function extractCoordinatesFromText(text) {
        if (!text) return null;
        const value = text.trim();

        // Patterns inside Google Maps URLs: @lat,lon or q=lat,lon
        const atMatch = value.match(/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
        if (atMatch) {
            return { lat: parseFloat(atMatch[1]), lon: parseFloat(atMatch[2]) };
        }
        const qMatch = value.match(/[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
        if (qMatch) {
            return { lat: parseFloat(qMatch[1]), lon: parseFloat(qMatch[2]) };
        }

        // Plain coordinates: "17.4123, 78.4567"
        const plainMatch = value.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
        if (plainMatch) {
            return { lat: parseFloat(plainMatch[1]), lon: parseFloat(plainMatch[2]) };
        }

        return null;
    }

    // Convert pasted maps links / coordinates into a readable address in the field
    async function resolvePastedLocation(rawValue) {
        if (!rawValue) return;

        // 1) Prefer the explicit place name embedded in the URL (closest to what user sees)
        const name = extractPlaceNameFromText(rawValue);

        // 2) Also try to grab coordinates (may be used to enrich context)
        const coords = extractCoordinatesFromText(rawValue);

        // Helper to show suggestions after setting the value
        function showSuggestionsForCurrentValue() {
            const query = input.value.toLowerCase();
            const localMatches = baseSuggestions.filter(loc =>
                loc.toLowerCase().includes(query)
            );
            renderSuggestions(localMatches.slice(0, 20));
        }

        // Case A: we have both a name and coordinates → use name + area from reverse geocode
        if (name && coords) {
            try {
                const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lon}`;
                const response = await fetch(url, {
                    headers: { Accept: 'application/json' }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data && data.display_name) {
                        const parts = data.display_name.split(',').map(p => p.trim());
                        // Take a couple of parts after the first (area + city) if available
                        const areaBits = parts.slice(1, 3).join(', ');
                        input.value = areaBits
                            ? `${name}, ${areaBits}`
                            : name;
                        showSuggestionsForCurrentValue();
                        return;
                    }
                }
            } catch (err) {
                console.error('Failed to enrich pasted location with area:', err);
            }

            // Fallback: just use the name
            input.value = name;
            showSuggestionsForCurrentValue();
            return;
        }

        // Case B: only name found
        if (name) {
            input.value = name;
            showSuggestionsForCurrentValue();
            return;
        }

        // Case C: no name, only coordinates → reverse geocode
        if (!coords) return;

        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lon}`;
            const response = await fetch(url, {
                headers: { Accept: 'application/json' }
            });

            if (!response.ok) return;

            const data = await response.json();
            if (!data || !data.display_name) return;

            const full = data.display_name;
            const firstComma = full.indexOf(',');
            const short = firstComma > 0 ? full.slice(0, firstComma) : full;

            input.value = short.trim();
            showSuggestionsForCurrentValue();
        } catch (err) {
            console.error('Failed to resolve pasted location:', err);
        }
    }

    async function searchNominatimHyderabad(query) {
        // Use Nominatim to search broadly within Hyderabad, but keep responses
        // small and focused so they are fast and easy to read.
        //
        // - limit=10 for speed
        // - bounded + viewbox around Hyderabad so we don't get far away cities
        // - We still append "Hyderabad" to keep context
        const baseQuery = query.toLowerCase().includes('hyderabad')
            ? query
            : `${query} Hyderabad`;

        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&bounded=1&viewbox=78.22,17.60,78.60,17.20&countrycodes=in&q=${encodeURIComponent(
            baseQuery
        )}`;

        const response = await fetch(url, {
            headers: {
                Accept: 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Nominatim request failed');
        }

        const data = await response.json();

        // Build short, user-friendly labels:
        // - Use the first part before the comma as primary text
        //   (e.g. "Road No 5 Banjara Hills")
        // - We still use full name internally for uniqueness, but display the short text
        const names = data
            .map(r => {
                const full = typeof r.display_name === 'string' ? r.display_name : '';
                if (!full) return null;

                const firstComma = full.indexOf(',');
                const short = firstComma > 0 ? full.slice(0, firstComma) : full;
                return short.trim();
            })
            .filter(name => !!name);

        // Prioritise entries that start with the query text, then sort alphabetically
        const lowerQuery = query.toLowerCase();
        names.sort((a, b) => {
            const aStarts = a.toLowerCase().startsWith(lowerQuery);
            const bStarts = b.toLowerCase().startsWith(lowerQuery);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.localeCompare(b);
        });

        return names;
    }

    input.addEventListener('focus', () => {
        if (!input.value.trim()) {
            showDefaultList();
        }
    });

    input.addEventListener('input', function () {
        const query = input.value.toLowerCase().trim();

        // Clear any pending Nominatim search
        if (nominatimTimeoutId) {
            clearTimeout(nominatimTimeoutId);
            nominatimTimeoutId = null;
        }

        if (!query) {
            showDefaultList();
            return;
        }

        // Start with local matches (alphabetical)
        const localMatches = baseSuggestions.filter(loc =>
            loc.toLowerCase().includes(query)
        );

        renderSuggestions(localMatches.slice(0, 20));

        // Debounce remote search (OpenStreetMap) with a short delay for snappier UX
        nominatimTimeoutId = setTimeout(async () => {
            try {
                const remote = await searchNominatimHyderabad(query);
                const combined = [...localMatches];

                remote.forEach(name => {
                    if (!combined.some(existing => existing.toLowerCase() === name.toLowerCase())) {
                        combined.push(name);
                    }
                });

                // Final alphabetical sort of all suggestions
                combined.sort((a, b) => a.localeCompare(b));

                // Show up to 40 suggestions in dropdown
                renderSuggestions(combined.slice(0, 40));
            } catch (e) {
                // On error, keep local matches only
                renderSuggestions(localMatches.slice(0, 20));
            }
        }, 150);
    });

    document.addEventListener('click', function (e) {
        if (!wrapper.contains(e.target)) {
            list.style.display = 'none';
        }
    });

    // When user pastes a WhatsApp / maps link or coordinates, auto-convert to address
    input.addEventListener('paste', function () {
        setTimeout(() => resolvePastedLocation(input.value), 0);
    });
}

// -----------------------------
// Schedule modal (Shoffr-style)
// -----------------------------

function setupScheduleModal() {
    const scheduleDisplay = document.getElementById('scheduleDisplay');
    const scheduleDisplayText = document.getElementById('scheduleDisplayText');
    const modal = document.getElementById('scheduleModal');
    const closeBtn = document.getElementById('scheduleCloseBtn');
    const confirmBtn = document.getElementById('scheduleConfirmBtn');
    const dateInputHidden = document.getElementById('bookingDate');
    const timeSlotHidden = document.getElementById('timeSlot');
    const dateInput = document.getElementById('scheduleDateInput');
    const dateChips = document.querySelectorAll('.chip-date');
    const timeChips = document.querySelectorAll('.chip-time');

    if (!scheduleDisplay || !modal || !confirmBtn || !dateInputHidden || !timeSlotHidden || !dateInput) {
        return;
    }

    function openModal() {
        const carId = document.getElementById('carId').value;
        if (!carId) {
            alert('Please select a car first before choosing a schedule.');
            return;
        }
        modal.classList.remove('hidden');
        // Check availability if date is already set
        if (dateInput.value) {
            checkAvailability();
        }
    }

    function closeModal() {
        modal.classList.add('hidden');
    }

    function setToday(dateEl) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;
        dateEl.value = todayStr;
        dateEl.min = todayStr;
    }

    // Init date input with today/min
    setToday(dateInput);

    scheduleDisplay.addEventListener('click', openModal);
    scheduleDisplay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal();
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // Date chips
    dateChips.forEach(chip => {
        chip.addEventListener('click', () => {
            dateChips.forEach(c => c.classList.remove('chip-selected'));
            chip.classList.add('chip-selected');
            const mode = chip.getAttribute('data-date-mode');

            if (mode === 'today') {
                setToday(dateInput);
                checkAvailability();
            } else if (mode === 'tomorrow') {
                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                const yyyy = tomorrow.getFullYear();
                const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
                const dd = String(tomorrow.getDate()).padStart(2, '0');
                const tomorrowStr = `${yyyy}-${mm}-${dd}`;
                dateInput.value = tomorrowStr;
                dateInput.min = new Date().toISOString().split('T')[0];
                checkAvailability();
            } else {
                // custom: just focus the date input
                dateInput.focus();
            }
        });
    });

    // Check availability when date changes
    dateInput.addEventListener('change', checkAvailability);

    // Time chips
    timeChips.forEach(chip => {
        chip.addEventListener('click', () => {
            timeChips.forEach(c => c.classList.remove('chip-selected'));
            chip.classList.add('chip-selected');
        });
    });

    confirmBtn.addEventListener('click', () => {
        const dateVal = dateInput.value;
        const selectedTimeChip = Array.from(timeChips).find(c => c.classList.contains('chip-selected') && !c.disabled);
        const timeSlotVal = selectedTimeChip ? selectedTimeChip.getAttribute('data-time-slot') : '';

        if (!dateVal || !timeSlotVal) {
            alert('Please select both date and an available time slot.');
            return;
        }

        // Save to hidden fields
        dateInputHidden.value = dateVal;
        timeSlotHidden.value = timeSlotVal;

        // Update display text
        const displayDate = new Date(dateVal);
        const dateText = displayDate.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            weekday: 'short'
        });

        if (scheduleDisplayText) {
            scheduleDisplayText.textContent = `${dateText} · ${timeSlotVal.replace('-', ' - ')}`;
        }

        // After schedule is chosen, update which consultants are available for this slot
        updateConsultantAvailability(dateVal, timeSlotVal);

        closeModal();
    });
}

// Disable consultants who are already booked for the chosen date + slot
async function updateConsultantAvailability(dateStr, timeSlot) {
    const consultantSelect = document.getElementById('consultantName');
    if (!consultantSelect || !dateStr || !timeSlot) return;

    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/bookings?booking_date=eq.${dateStr}&time_slot=eq.${encodeURIComponent(timeSlot)}&select=consultant_name`,
            {
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );

        if (!response.ok) {
            console.warn('Consultant list availability fetch failed.');
            return;
        }

        const rows = await response.json();
        const bookedConsultants = new Set(
            rows
                .map(r => r.consultant_name)
                .filter(name => typeof name === 'string' && name.trim() !== '')
        );

        // Reset current selection if it becomes unavailable
        if (bookedConsultants.has(consultantSelect.value)) {
            consultantSelect.value = '';
        }

        // Update options: disable those already booked for that slot
        Array.from(consultantSelect.options).forEach(opt => {
            if (!opt.value) {
                opt.disabled = false;
                return;
            }

            if (bookedConsultants.has(opt.value)) {
                opt.disabled = true;
                opt.textContent = `${opt.value} (Booked)`;
            } else {
                opt.disabled = false;
                opt.textContent = opt.value;
            }
        });
    } catch (err) {
        console.error('Error updating consultant availability:', err);
    }
}

// Check availability for selected car and date
async function checkAvailability() {
    const carId = document.getElementById('carId').value;
    const dateInput = document.getElementById('scheduleDateInput');
    const selectedDate = dateInput ? dateInput.value : '';

    if (!carId || !selectedDate) {
        // Reset all time chips to enabled if no car/date selected
        document.querySelectorAll('.chip-time').forEach(chip => {
            chip.disabled = false;
            chip.classList.remove('chip-booked');
            chip.title = '';
        });
        return;
    }

    try {
        // Fetch existing bookings for this car and date
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/bookings?car_id=eq.${carId}&booking_date=eq.${selectedDate}&select=time_slot`,
            {
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Availability check error:', {
                status: response.status,
                error: errorText,
                url: `${SUPABASE_URL}/rest/v1/bookings?car_id=eq.${carId}&booking_date=eq.${selectedDate}`
            });
            throw new Error(`Failed to check availability: ${errorText}`);
        }

        const bookings = await response.json();
        const carBookedSlots = new Set(bookings.map(b => b.time_slot));

        // Also fetch bookings for the selected consultant on this date (any car)
        const consultantSelect = document.getElementById('consultantName');
        let consultantBookedSlots = new Set();
        if (consultantSelect && consultantSelect.value) {
            const consultant = encodeURIComponent(consultantSelect.value);
            const consResponse = await fetch(
                `${SUPABASE_URL}/rest/v1/bookings?consultant_name=eq.${consultant}&booking_date=eq.${selectedDate}&select=time_slot`,
                {
                    headers: {
                        apikey: SUPABASE_ANON_KEY,
                        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
                    }
                }
            );

            if (consResponse.ok) {
                const consBookings = await consResponse.json();
                consultantBookedSlots = new Set(consBookings.map(b => b.time_slot));
            } else {
                console.warn('Consultant availability check failed, falling back to car-only availability.');
            }
        }

        // Update time chips: disable if slot is in the past, or consultant is booked, or car is booked
        document.querySelectorAll('.chip-time').forEach(chip => {
            const slot = chip.getAttribute('data-time-slot');

            if (isSlotInPast(selectedDate, slot)) {
                chip.disabled = true;
                chip.classList.add('chip-booked');
                chip.classList.remove('chip-selected');
                chip.title = 'This slot time is already over';
            } else if (consultantBookedSlots.has(slot)) {
                chip.disabled = true;
                chip.classList.add('chip-booked');
                chip.classList.remove('chip-selected');
                chip.title = 'This consultant is already booked for this time';
            } else if (carBookedSlots.has(slot)) {
                chip.disabled = true;
                chip.classList.add('chip-booked');
                chip.classList.remove('chip-selected');
                chip.title = 'This slot is already booked';
            } else {
                chip.disabled = false;
                chip.classList.remove('chip-booked');
                chip.title = '';
            }
        });
    } catch (err) {
        console.error('Error checking availability:', err);
        // On error, enable all slots (fail open)
        document.querySelectorAll('.chip-time').forEach(chip => {
            chip.disabled = false;
            chip.classList.remove('chip-booked');
        });
    }
}

// Submit booking
async function submitBooking() {
    // Validate customer form (HTML5 required fields)
    const customerForm = document.getElementById('customerForm');
    if (!customerForm.checkValidity()) {
        customerForm.reportValidity();
        return;
    }

    // Extra validation for schedule (because hidden inputs are not required in HTML)
    const bookingDateVal = document.getElementById('bookingDate').value;
    const timeSlotVal = document.getElementById('timeSlot').value;
    const carId = document.getElementById('carId').value;
    
    if (!bookingDateVal || !timeSlotVal) {
        alert('Please select schedule (date and time) before submitting.');
        return;
    }

    if (!carId) {
        alert('Please select a car before submitting.');
        return;
    }

    // Check for double booking before submitting
    try {
        const conflictCheck = await fetch(
            `${SUPABASE_URL}/rest/v1/bookings?car_id=eq.${carId}&booking_date=eq.${bookingDateVal}&time_slot=eq.${encodeURIComponent(timeSlotVal)}&select=id`,
            {
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );

        if (!conflictCheck.ok) {
            const errorText = await conflictCheck.text();
            console.error('Conflict check error:', {
                status: conflictCheck.status,
                error: errorText
            });
            throw new Error(`Failed to check for conflicts: ${errorText}`);
        }

        const conflicts = await conflictCheck.json();
        if (conflicts.length > 0) {
            alert('This time slot is already booked for the selected car. Please choose a different slot.');
            // Reopen modal to select different slot
            document.getElementById('scheduleModal').classList.remove('hidden');
            return;
        }

        // Also ensure the selected consultant is not booked on any car for this date and slot
        const consultantName = document.getElementById('consultantName').value;
        if (consultantName) {
            const consultantConflict = await fetch(
                `${SUPABASE_URL}/rest/v1/bookings?consultant_name=eq.${encodeURIComponent(consultantName)}&booking_date=eq.${bookingDateVal}&time_slot=eq.${encodeURIComponent(timeSlotVal)}&select=id`,
                {
                    headers: {
                        apikey: SUPABASE_ANON_KEY,
                        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
                    }
                }
            );

            if (!consultantConflict.ok) {
                const errorText = await consultantConflict.text();
                console.error('Consultant conflict check error:', {
                    status: consultantConflict.status,
                    error: errorText
                });
                throw new Error(`Failed to check consultant conflicts: ${errorText}`);
            }

            const consultantConflicts = await consultantConflict.json();
            if (consultantConflicts.length > 0) {
                alert('This consultant is already booked for this time slot on another car. Please choose a different consultant or slot.');
                document.getElementById('scheduleModal').classList.remove('hidden');
                return;
            }
        }
    } catch (err) {
        console.error('Error checking conflicts:', err);
        // Continue anyway, but warn user
        if (!confirm('Could not verify slot availability. Do you want to proceed anyway?')) {
            return;
        }
    }

    // Prepare payload for Supabase
    const booking = {
        customer_name: document.getElementById('customerName').value,
        consultant_name: document.getElementById('consultantName').value,
        customer_location: document.getElementById('customerLocation').value,
        booking_date: bookingDateVal,
        customer_phone: document.getElementById('phoneNumber').value,
        time_slot: timeSlotVal,
        test_drive_type: document.querySelector('input[name="testDriveType"]:checked').value,
        car_id: Number(carId)
    };

    // Send booking to Supabase REST API
    fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: 'return=representation'
        },
        body: JSON.stringify(booking)
    })
        .then(async (res) => {
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Supabase insert failed');
            }
            return res.json();
        })
        .then((rows) => {
            console.log('Booking saved to Supabase:', rows[0]);
            alert('Booking submitted and saved to Supabase!');
            // Reset form
            customerForm.reset();
            document.getElementById('scheduleDisplayText').textContent = 'Select schedule';
            document.getElementById('selectedCar').value = '';
            document.getElementById('carId').value = '';
            // Refresh availability table
            loadAvailabilityTable();
        })
        .catch((err) => {
            console.error('Error saving to Supabase:', err);
            alert('There was an error saving booking to Supabase. Check console for details.');
        });
}

// Submit new car to Supabase (Manage Cars page)
async function submitNewCar() {
    const carForm = document.getElementById('carForm');
    if (!carForm) return;

    if (!carForm.checkValidity()) {
        carForm.reportValidity();
        return;
    }

    const carMake = document.getElementById('carMake').value.trim();
    const carModel = document.getElementById('carModel').value.trim();
    const carVariant = document.getElementById('carVariant').value;
    const carYear = document.getElementById('carYear').value;

    const payload = {
        car_make: carMake,
        car_model: carModel,
        car_variant: carVariant,
        year_of_manufacture: carYear
    };

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/cars`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                Prefer: 'return=representation'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const text = await res.text();
            console.error('Error adding car:', text);
            alert('There was an error adding the car. Please check console for details.');
            return;
        }

        const rows = await res.json();
        console.log('Car added:', rows[0]);
        alert('New car added to inventory!');

        // Reset the form
        carForm.reset();

        // Reload cars in booking dropdown and availability table
        await loadCars();
        await loadAvailabilityTable();

        // Switch back to booking tab so user can immediately use the new car
        switchMainView('booking');
    } catch (err) {
        console.error('Unexpected error adding car:', err);
        alert('Unexpected error while adding car. Please try again.');
    }
}
