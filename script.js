// Supabase config (fill these with your actual project values)
const SUPABASE_URL = 'https://iawznkckpbufhprkmufc.supabase.co'; // TODO: replace
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhd3pua2NrcGJ1ZmhwcmttdWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2Mzc0MjMsImV4cCI6MjA4MjIxMzQyM30.ce_cyJC18sL6JLnoEKpe6jBx5UZH6VQSmqnxtDrMaXA'; // TODO: replace

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    // Load slots first so schedule modal & availability use the latest configuration
    loadSlots().finally(() => {
        initializeEventListeners();
        setupHyderabadLocationSuggestions();
        loadCars(); // Load cars from Supabase
        loadAvailabilityTable(); // Load availability table
    });
});

// Initialize all event listeners
function initializeEventListeners() {
    // Simple tab navigation between Booking and Manage Cars
    const tabBooking = document.getElementById('tabBooking');
    const tabManageCars = document.getElementById('tabManageCars');
    const tabManageSlots = document.getElementById('tabManageSlots');
    if (tabBooking && tabManageCars && tabManageSlots) {
        tabBooking.addEventListener('click', () => switchMainView('booking'));
        tabManageCars.addEventListener('click', () => switchMainView('manageCars'));
        tabManageSlots.addEventListener('click', () => switchMainView('manageSlots'));
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

    // Add Slot button (Manage Slots page)
    const addSlotBtn = document.getElementById('addSlotBtn');
    if (addSlotBtn) {
        addSlotBtn.addEventListener('click', submitNewSlot);
    }

    // Slot car filter (Manage Slots page - right side)
    const slotCarFilter = document.getElementById('slotCarFilter');
    if (slotCarFilter) {
        slotCarFilter.addEventListener('change', () => {
            renderManageSlotsList();
        });
    }

    // Slot car selector on left side (Manage Time Slots form) - keep in sync
    const slotCarSelect = document.getElementById('slotCarSelect');
    if (slotCarSelect) {
        slotCarSelect.addEventListener('change', () => {
            const filter = document.getElementById('slotCarFilter');
            if (filter) {
                filter.value = slotCarSelect.value;
            }
            renderManageSlotsList();
        });
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

    // Car availability filter input
    const availabilityFilter = document.getElementById('carAvailabilityFilter');
    if (availabilityFilter) {
        // Real-time filtering as user types (with debounce)
        let filterTimeout;
        availabilityFilter.addEventListener('input', function() {
            clearTimeout(filterTimeout);
            filterTimeout = setTimeout(() => {
                filterAvailabilityTable(this.value);
            }, 200);
        });

        // Also filter on Enter key
        availabilityFilter.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                filterAvailabilityTable(this.value);
            }
        });
    }
}

// Switch between booking page, manage cars, and manage slots pages
function switchMainView(view) {
    const bookingPage = document.getElementById('bookingPage');
    const manageCarsPage = document.getElementById('manageCarsPage');
    const manageSlotsPage = document.getElementById('manageSlotsPage');
    const tabBooking = document.getElementById('tabBooking');
    const tabManageCars = document.getElementById('tabManageCars');
    const tabManageSlots = document.getElementById('tabManageSlots');

    const showBooking = view === 'booking';
    const showCars = view === 'manageCars';
    const showSlots = view === 'manageSlots';

    if (bookingPage) bookingPage.style.display = showBooking ? 'flex' : 'none';
    if (manageCarsPage) manageCarsPage.style.display = showCars ? 'flex' : 'none';
    if (manageSlotsPage) manageSlotsPage.style.display = showSlots ? 'flex' : 'none';

    if (tabBooking) {
        if (showBooking) tabBooking.classList.add('tab-active');
        else tabBooking.classList.remove('tab-active');
    }
    if (tabManageCars) {
        if (showCars) tabManageCars.classList.add('tab-active');
        else tabManageCars.classList.remove('tab-active');
    }
    if (tabManageSlots) {
        if (showSlots) tabManageSlots.classList.add('tab-active');
        else tabManageSlots.classList.remove('tab-active');
    }
}

// Store cars data globally
let carsData = [];

// Grouped cars by model (make + model + variant)
// {
//   [modelKey]: { label: 'Mercedes GLA (Diesel)', cars: [car, car, ...] }
// }
let carModelGroups = {};

function getCarModelKeyFromCar(car) {
    const make = (car.car_make || '').trim();
    const model = (car.car_model || '').trim();
    const variant = (car.car_variant || '').trim();
    // Use a delimiter that is unlikely to appear in names
    return `${make}||${model}||${variant}`;
}

function getCarsForModelKey(modelKey) {
    const group = carModelGroups[modelKey];
    return group ? group.cars : [];
}

// -----------------------------
// Slots - dynamic management
// -----------------------------

async function loadSlots() {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/slots?select=*&is_active=eq.true&order=sort_order,time_slot`,
            {
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );

        if (!response.ok) {
            const text = await response.text();
            console.error('Error loading slots:', text);
            return;
        }

        slotsData = await response.json();
        if (slotsData && slotsData.length > 0) {
            ALL_TIME_SLOTS = slotsData.map((s) => s.time_slot);
        }

        renderSlotCarFilter();
        renderManageSlotsList();

        console.log(`✅ Loaded ${slotsData.length} slots. Current ALL_TIME_SLOTS:`, ALL_TIME_SLOTS);
    } catch (err) {
        console.error('Unexpected error loading slots:', err);
    }
}

// Populate the car filter dropdown on the Manage Slots page
function renderSlotCarFilter() {
    const slotCarFilter = document.getElementById('slotCarFilter');
    const slotCarSelect = document.getElementById('slotCarSelect');
    if (!slotCarFilter && !slotCarSelect) return;

    const previous = slotCarFilter.value;

    // Clear options
    if (slotCarFilter) {
        slotCarFilter.innerHTML = '';
        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = 'All cars';
        slotCarFilter.appendChild(allOption);
    }
    if (slotCarSelect) {
        slotCarSelect.innerHTML = '';
        const allOption2 = document.createElement('option');
        allOption2.value = '';
        allOption2.textContent = 'All cars';
        slotCarSelect.appendChild(allOption2);
    }

    const modelKeys = Object.keys(carModelGroups || {});
    modelKeys
        .sort((a, b) => carModelGroups[a].label.localeCompare(carModelGroups[b].label))
        .forEach((key) => {
            const group = carModelGroups[key];
            const count = group.cars ? group.cars.length : 0;
            const label = count > 1 ? `${group.label} — ${count} cars` : group.label;

            if (slotCarFilter) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = label;
                slotCarFilter.appendChild(opt);
            }
            if (slotCarSelect) {
                const opt2 = document.createElement('option');
                opt2.value = key;
                opt2.textContent = label;
                slotCarSelect.appendChild(opt2);
            }
        });

    // Try to keep previous selection if still valid
    if (slotCarFilter) {
        if (previous && modelKeys.includes(previous)) {
            slotCarFilter.value = previous;
        } else {
            slotCarFilter.value = '';
        }
    }
    if (slotCarSelect && slotCarFilter) {
        // keep both in sync
        slotCarSelect.value = slotCarFilter.value;
    }
}

function renderManageSlotsList() {
    const manageSlotsList = document.getElementById('manageSlotsList');
    if (!manageSlotsList) return;

    if (!slotsData || slotsData.length === 0) {
        manageSlotsList.innerHTML =
            '<p class="manage-cars-empty">No slots configured yet. Add a slot on the left.</p>';
        return;
    }

    manageSlotsList.innerHTML = '';

    const slotCarFilter = document.getElementById('slotCarFilter');
    const filterModelKey = slotCarFilter ? slotCarFilter.value : '';

    slotsData.forEach((slot, index) => {
        const card = document.createElement('div');
        card.className = 'manage-car-card';

        const label = slot.label || slot.time_slot || 'Unnamed slot';

        let usageHtml = '';

        const modelKeys = filterModelKey ? [filterModelKey] : Object.keys(carModelGroups);

        if (!modelKeys || modelKeys.length === 0) {
            usageHtml =
                '<div class="manage-car-subtitle">No cars configured. Add cars on the Manage Cars page.</div>';
        } else {
            const lines = [];

            modelKeys.forEach((modelKey) => {
                const group = carModelGroups[modelKey];
                if (!group) return;
                const carsForModel = group.cars || [];

                // Bookings for this model + slot
                const bookingsForThisModelAndSlot =
                    (allBookingsData || []).filter((b) => {
                        if (b.time_slot !== slot.time_slot || !b.cars) return false;
                        const mk = getCarModelKeyFromCar(b.cars);
                        return mk === modelKey;
                    }) || [];

                carsForModel.forEach((car) => {
                    const booking = bookingsForThisModelAndSlot.find((b) => b.car_id === car.id);
                    const vin = car.vin || `Car ID ${car.id}`;
                    const modelLabel = `${car.car_make} ${car.car_model} (${car.car_variant})`;
                    const consultant = booking ? booking.consultant_name || '—' : null;

                    const statusText = booking
                        ? `Booked${consultant ? ` • 👤 ${consultant}` : ''}`
                        : 'Available';

                    lines.push(`
                        <div class="slot-usage-line">
                            <span class="slot-usage-main">${modelLabel}</span>
                            <span class="slot-usage-vin">VIN: ${vin}</span>
                            <span class="slot-usage-consultant">${statusText}</span>
                        </div>
                    `);
                });
            });

            usageHtml =
                lines.length > 0
                    ? lines.join('')
                    : '<div class="manage-car-subtitle">No cars match this filter for this slot.</div>';
        }

        card.innerHTML = `
            <div class="manage-car-main">
                <div class="manage-car-title">${label}</div>
                <div class="manage-car-subtitle">Value: ${slot.time_slot}</div>
                <div class="slot-usage-container">
                    ${usageHtml}
                </div>
            </div>
            <div class="manage-car-side">
                <span class="manage-car-chip">Slot #${index + 1}</span>
            </div>
        `;

        manageSlotsList.appendChild(card);
    });
}

async function submitNewSlot() {
    const slotForm = document.getElementById('slotForm');
    if (!slotForm) return;

    if (!slotForm.checkValidity()) {
        slotForm.reportValidity();
        return;
    }

    const start = document.getElementById('slotStart').value;
    const end = document.getElementById('slotEnd').value;
    const labelInput = document.getElementById('slotLabel').value.trim();

    if (!start || !end) {
        alert('Please select both start and end times for the slot.');
        return;
    }

    if (end <= start) {
        alert('End time must be after start time.');
        return;
    }

    const formattedStart = start.slice(0, 5);
    const formattedEnd = end.slice(0, 5);
    const timeSlot = `${formattedStart}-${formattedEnd}`;
    const label = labelInput || `${formattedStart} - ${formattedEnd}`;

    const payload = {
        label,
        time_slot: timeSlot
    };

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/slots`, {
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
            console.error('Error adding slot:', text);
            alert('There was an error adding the slot. Please check console for details.');
            return;
        }

        const rows = await res.json();
        console.log('Slot added:', rows[0]);
        alert('New slot added!');

        slotForm.reset();

        await loadSlots();
    } catch (err) {
        console.error('Unexpected error adding slot:', err);
        alert('Unexpected error while adding slot. Please try again.');
    }
}

function getCarsForModelKey(modelKey) {
    const group = carModelGroups[modelKey];
    return group ? group.cars : [];
}

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
        const response = await fetch(`${SUPABASE_URL}/rest/v1/cars?select=*&order=car_make,car_model,car_variant`, {
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation'
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
                carSelect.innerHTML =
                    '<option value="">⚠️ Table not found. Check: 1) Table name is "cars" 2) Table is in "public" schema 3) RLS policy allows SELECT</option>';
                return;
            }

            if (response.status === 401 || response.status === 403) {
                carSelect.innerHTML =
                    '<option value="">⚠️ Permission denied. Check RLS policy "allow_select_cars_for_anon" exists.</option>';
                return;
            }

            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        carsData = await response.json();

        // Build groups by model
        carModelGroups = {};
        carsData.forEach((car) => {
            const key = getCarModelKeyFromCar(car);
            if (!carModelGroups[key]) {
                const label = `${car.car_make} ${car.car_model} (${car.car_variant})`.trim();
                carModelGroups[key] = {
                    label: label || 'Unnamed model',
                    cars: []
                };
            }
            carModelGroups[key].cars.push(car);
        });

        const modelKeys = Object.keys(carModelGroups);

        if (modelKeys.length === 0) {
            carSelect.innerHTML = '<option value="">No cars available. Please add cars in Supabase.</option>';
            renderManageCarsList();
            return;
        }

        // Populate dropdown with ONE option per model (not per physical car)
        carSelect.innerHTML = '<option value="">Select a car</option>';
        modelKeys
            .sort((a, b) => carModelGroups[a].label.localeCompare(carModelGroups[b].label))
            .forEach((key) => {
                const group = carModelGroups[key];
                const count = group.cars.length;
                const option = document.createElement('option');
                option.value = key; // store model key, not car_id
                option.textContent =
                    count > 1 ? `${group.label} — ${count} cars` : group.label;
                carSelect.appendChild(option);
            });

        // Update car filter on Manage Slots page as well
        renderSlotCarFilter();

        console.log(`✅ Loaded ${carsData.length} cars successfully across ${modelKeys.length} models`);

        // Also render list in Manage Cars page (all physical cars)
        renderManageCarsList();
    } catch (err) {
        console.error('Error loading cars:', err);

        // Check for specific error types
        if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
            if (err.message.includes('ERR_NAME_NOT_RESOLVED') || err.message.includes('network')) {
                carSelect.innerHTML =
                    '<option value="">⚠️ Network error: Cannot reach Supabase. Check: 1) Internet connection 2) Supabase URL is correct 3) No firewall blocking</option>';
            } else {
                carSelect.innerHTML =
                    '<option value="">⚠️ Connection failed. Check internet connection and Supabase URL.</option>';
            }
        } else if (err.message && err.message.includes('CORS')) {
            carSelect.innerHTML =
                '<option value="">⚠️ CORS error: Check Supabase project settings and allowed origins.</option>';
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
        const vin = car.vin ? `VIN: ${car.vin}` : '';

        card.innerHTML = `
            <div class="manage-car-main">
                <div class="manage-car-title">${title}${year}</div>
                <div class="manage-car-subtitle">Variant: ${car.car_variant || '-'}${vin ? ` • ${vin}` : ''}</div>
            </div>
            <div class="manage-car-side">
                <span class="manage-car-chip">Car #${index + 1}</span>
                <button type="button" class="manage-car-delete-btn" data-car-id="${car.id}" title="Delete car from inventory">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        `;

        // Add click handler for delete button
        const deleteBtn = card.querySelector('.manage-car-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Delete button clicked for car:', { id: car.id, name: title });
                deleteCar(car.id, title);
            });
        } else {
            console.warn('Delete button not found for car:', car.id);
        }

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

// All possible time slots (will be overwritten by slots from Supabase)
let ALL_TIME_SLOTS = ['09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00'];
let slotsData = [];

// Store bookings data globally for filtering
let allBookingsData = [];

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
            `${SUPABASE_URL}/rest/v1/bookings?booking_date=gte.${today}&select=id,booking_date,time_slot,consultant_name,test_drive_type,customer_location,car_id,cars!inner(car_make,car_model,car_variant,vin)&order=booking_date,time_slot,car_id`,
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
        
        // Store bookings globally for filtering and slots usage view
        allBookingsData = bookings || [];

        renderManageSlotsList();

        // Check if there's an active filter
        const filterInput = document.getElementById('carAvailabilityFilter');
        const activeFilter = filterInput ? filterInput.value.trim() : '';

        // Render table view (filtered if search is active)
        if (activeFilter) {
            filterAvailabilityTable(activeFilter);
        } else {
            renderAvailabilityTable(allBookingsData);
        }

        loadingEl.style.display = 'none';
        if (!bookings || bookings.length === 0) {
            emptyEl.style.display = 'block';
            contentEl.style.display = 'none';
        } else {
            if (!activeFilter) {
                contentEl.style.display = 'block';
            }
        }
    } catch (err) {
        console.error('Error loading availability table:', err);
        loadingEl.style.display = 'none';
        contentEl.innerHTML = '<p style="color: #fca5a5; text-align: center; padding: 20px;">Error loading availability. Please refresh.</p>';
        contentEl.style.display = 'block';
    }
}

// Render availability as grid: Time slots as rows, MODELS as columns, VINs listed inside each cell
function renderAvailabilityTable(bookings) {
    const contentEl = document.getElementById('availabilityTableContent');
    const emptyEl = document.getElementById('availabilityTableEmpty');
    const noResultsEl = document.getElementById('availabilityTableNoResults');

    if (!contentEl) return;

    // Hide empty/no results messages initially
    if (emptyEl) emptyEl.style.display = 'none';
    if (noResultsEl) noResultsEl.style.display = 'none';

    if (!bookings || bookings.length === 0) {
        contentEl.innerHTML = '';
        return;
    }

    const slots = ALL_TIME_SLOTS;

    // Group bookings by MODEL (make + model + variant)
    const modelMap = new Map(); // modelKey -> { key, label }
    const bookingsGrid = new Map(); // modelKey -> slot -> [bookings]

    bookings.forEach((booking) => {
        if (!booking.cars || !booking.time_slot) return;
        const car = booking.cars;
        const modelStub = {
            car_make: car.car_make,
            car_model: car.car_model,
            car_variant: car.car_variant
        };
        const modelKey = getCarModelKeyFromCar(modelStub);
        const label = `${car.car_make} ${car.car_model} (${car.car_variant})`;

        if (!modelMap.has(modelKey)) {
            modelMap.set(modelKey, { key: modelKey, label });
        }

        if (!bookingsGrid.has(modelKey)) {
            bookingsGrid.set(modelKey, new Map());
        }

        const slotMap = bookingsGrid.get(modelKey);
        const slot = booking.time_slot;
        if (!slotMap.has(slot)) {
            slotMap.set(slot, []);
        }
        slotMap.get(slot).push(booking);
    });

    const models = Array.from(modelMap.values()).sort((a, b) => a.label.localeCompare(b.label));

    // Create table structure
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'availability-table-wrapper';
    tableWrapper.setAttribute('role', 'region');
    tableWrapper.setAttribute('aria-label', 'Car availability grid - models by column with VIN details');

    const table = document.createElement('table');
    table.className = 'availability-grid-table';

    const timeSlotColWidth = 140;
    const modelColWidth = 220;
    const minTableWidth = timeSlotColWidth + models.length * modelColWidth;
    table.style.minWidth = `${minTableWidth}px`;
    table.style.width = `${minTableWidth}px`;

    // Header: Time Slot | Model 1 | Model 2 ...
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th class="th-time-slot">Time Slot</th>';

    models.forEach((model) => {
        const th = document.createElement('th');
        th.className = 'th-car';
        th.setAttribute('data-model-key', model.key);
        th.setAttribute('data-model-name', model.label.toLowerCase());
        th.textContent = model.label;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body: one row per time slot
    const tbody = document.createElement('tbody');

    slots.forEach((slot) => {
        const row = document.createElement('tr');
        row.className = 'availability-table-row';

        const slotCell = document.createElement('td');
        slotCell.className = 'td-time-slot-header';
        slotCell.textContent = slot;
        row.appendChild(slotCell);

        models.forEach((model) => {
            const cell = document.createElement('td');
            cell.className = 'td-booking-cell';
            cell.setAttribute('data-model-key', model.key);
            cell.setAttribute('data-time-slot', slot);

            const slotMap = bookingsGrid.get(model.key);
            const slotBookings = slotMap ? slotMap.get(slot) || [] : [];

            if (slotBookings.length === 0) {
                cell.innerHTML = '<div class="booking-cell-empty">—</div>';
                cell.classList.add('no-booking');
            } else {
                const linesHtml = slotBookings
                    .map((booking) => {
                        const consultant = booking.consultant_name || '—';
                        const location = booking.customer_location || '—';
                        const typeLabel = booking.test_drive_type === 'home' ? 'Home' : 'Branch';
                        const vin = (booking.cars && booking.cars.vin) || `Car ID ${booking.car_id}`;

                        return `
                            <div class="booking-line">
                                <div class="booking-line-header">
                                    <span class="booking-line-vin">VIN: ${vin}</span>
                                    <span class="booking-line-type">${typeLabel}</span>
                                </div>
                                <div class="booking-line-body">
                                    <span class="booking-line-consultant">👤 ${consultant}</span>
                                    <span class="booking-line-location" title="${location}">📍 ${
                                        location.length > 25 ? `${location.substring(0, 25)}...` : location
                                    }</span>
                                </div>
                                <button type="button" class="btn-end-td-cell" data-booking-id="${booking.id}">End TD</button>
                            </div>
                        `;
                    })
                    .join('');

                cell.innerHTML = `<div class="booking-cell-multi">${linesHtml}</div>`;
                cell.classList.add('has-booking');
            }

            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableWrapper.appendChild(table);

    contentEl.innerHTML = '';
    contentEl.appendChild(tableWrapper);

    document.querySelectorAll('.btn-end-td-cell').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-booking-id');
            if (id) {
                endTestDrive(Number(id));
            }
        });
    });
}

// Filter availability table by car name (show/hide MODEL columns)
function filterAvailabilityTable(searchTerm) {
    if (!allBookingsData || allBookingsData.length === 0) {
        return;
    }

    const filterLower = searchTerm.toLowerCase().trim();
    const contentEl = document.getElementById('availabilityTableContent');
    const emptyEl = document.getElementById('availabilityTableEmpty');
    const noResultsEl = document.getElementById('availabilityTableNoResults');

    // Get all model columns
    const modelHeaders = document.querySelectorAll('.th-car');

    if (!filterLower) {
        // Show all model columns if search is empty
        modelHeaders.forEach(th => {
            th.style.display = '';
            const modelKey = th.getAttribute('data-model-key');
            // Show all cells for this model
            document.querySelectorAll(`.td-booking-cell[data-model-key="${modelKey}"]`).forEach(cell => {
                cell.style.display = '';
            });
        });
        if (emptyEl) emptyEl.style.display = 'none';
        if (noResultsEl) noResultsEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
        return;
    }

    // Filter: Show only columns where model name matches search
    let visibleCount = 0;
    modelHeaders.forEach(th => {
        const modelName = th.getAttribute('data-model-name') || '';
        const modelKey = th.getAttribute('data-model-key');
        
        if (modelName.includes(filterLower)) {
            // Show this model column
            th.style.display = '';
            document.querySelectorAll(`.td-booking-cell[data-model-key="${modelKey}"]`).forEach(cell => {
                cell.style.display = '';
            });
            visibleCount++;
        } else {
            // Hide this model column
            th.style.display = 'none';
            document.querySelectorAll(`.td-booking-cell[data-model-key="${modelKey}"]`).forEach(cell => {
                cell.style.display = 'none';
            });
        }
    });

    // Show/hide no results message
    if (visibleCount === 0) {
        if (contentEl) contentEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';
        if (noResultsEl) noResultsEl.style.display = 'block';
    } else {
        if (contentEl) contentEl.style.display = 'block';
        if (emptyEl) emptyEl.style.display = 'none';
        if (noResultsEl) noResultsEl.style.display = 'none';
    }
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

        // 204 No Content means successful deletion (Supabase returns this for DELETE)
        // 200 OK also means success
        if (res.status === 204 || res.status === 200) {
            console.log('Test drive ended successfully (status:', res.status, ')');
            alert('Test drive ended.');
            loadAvailabilityTable();
            return;
        }

        // Handle error responses
        if (!res.ok) {
            const text = await res.text();
            console.error('Error ending test drive:', {
                status: res.status,
                statusText: res.statusText,
                body: text
            });
            
            if (res.status === 401 || res.status === 403) {
                alert('Permission denied. Please check Supabase RLS policies for DELETE on the bookings table.');
            } else {
                alert('Could not end this test drive. Please check console for details.');
            }
            return;
        }
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
    const timeSlotsContainer = document.querySelector('.chip-row-time');

    if (!scheduleDisplay || !modal || !confirmBtn || !dateInputHidden || !timeSlotHidden || !dateInput || !timeSlotsContainer) {
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

    // Helper to build time slot chips from ALL_TIME_SLOTS
    function buildTimeChips() {
        timeSlotsContainer.innerHTML = '';
        ALL_TIME_SLOTS.forEach((slot) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'chip chip-time';
            btn.setAttribute('data-time-slot', slot);
            const [start, end] = slot.split('-');
            btn.textContent = `${start} - ${end}`;
            timeSlotsContainer.appendChild(btn);
        });
    }

    buildTimeChips();

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

    // Time chips (delegate so it works after rebuilds)
    timeSlotsContainer.addEventListener('click', (e) => {
        const target = e.target.closest('.chip-time');
        if (!target) return;
        const chips = timeSlotsContainer.querySelectorAll('.chip-time');
        chips.forEach((c) => c.classList.remove('chip-selected'));
        if (!target.disabled) {
            target.classList.add('chip-selected');
        }
    });

    confirmBtn.addEventListener('click', () => {
        const dateVal = dateInput.value;
        const selectedTimeChip = Array.from(timeSlotsContainer.querySelectorAll('.chip-time')).find(
            (c) => c.classList.contains('chip-selected') && !c.disabled
        );
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

// Check availability for selected car MODEL and date
// IMPORTANT: a slot is disabled only if ALL physical cars of that model are booked.
async function checkAvailability() {
    const modelKey = document.getElementById('carId').value; // carId now stores model key
    const dateInput = document.getElementById('scheduleDateInput');
    const selectedDate = dateInput ? dateInput.value : '';

    const resetChips = () => {
        document.querySelectorAll('.chip-time').forEach((chip) => {
            chip.disabled = false;
            chip.classList.remove('chip-booked');
            chip.title = '';
        });
    };

    if (!modelKey || !selectedDate) {
        resetChips();
        return;
    }

    const carsForModel = getCarsForModelKey(modelKey);
    if (!carsForModel || carsForModel.length === 0) {
        console.warn('No cars found for selected model key:', modelKey);
        resetChips();
        return;
    }

    try {
        const carIds = carsForModel.map((c) => c.id).filter((id) => typeof id === 'number' || typeof id === 'string');
        const idList = carIds.join(',');

        // Fetch existing bookings for ALL cars of this model on this date
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/bookings?car_id=in.(${idList})&booking_date=eq.${selectedDate}&select=car_id,time_slot`,
            {
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Availability check error (model-based):', {
                status: response.status,
                error: errorText,
                url: `${SUPABASE_URL}/rest/v1/bookings?car_id=in.(${idList})&booking_date=eq.${selectedDate}`
            });
            throw new Error(`Failed to check availability: ${errorText}`);
        }

        const bookings = await response.json();

        // Count how many cars are booked per slot for this model
        const slotBookingCounts = new Map(); // slot -> count
        bookings.forEach((b) => {
            if (!b.time_slot) return;
            const current = slotBookingCounts.get(b.time_slot) || 0;
            slotBookingCounts.set(b.time_slot, current + 1);
        });

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
                consultantBookedSlots = new Set(consBookings.map((b) => b.time_slot));
            } else {
                console.warn('Consultant availability check failed, falling back to model-only availability.');
            }
        }

        const totalCarsForModel = carsForModel.length;

        // Update time chips:
        // - disable if slot is in the past,
        // - OR consultant is booked,
        // - OR ALL cars of this model are booked for that slot.
        document.querySelectorAll('.chip-time').forEach((chip) => {
            const slot = chip.getAttribute('data-time-slot');

            if (isSlotInPast(selectedDate, slot)) {
                chip.disabled = true;
                chip.classList.add('chip-booked');
                chip.classList.remove('chip-selected');
                chip.title = 'This slot time is already over';
                return;
            }

            if (consultantBookedSlots.has(slot)) {
                chip.disabled = true;
                chip.classList.add('chip-booked');
                chip.classList.remove('chip-selected');
                chip.title = 'This consultant is already booked for this time';
                return;
            }

            const bookedCount = slotBookingCounts.get(slot) || 0;
            if (bookedCount >= totalCarsForModel) {
                chip.disabled = true;
                chip.classList.add('chip-booked');
                chip.classList.remove('chip-selected');
                chip.title = 'All cars of this model are already booked for this slot';
            } else {
                chip.disabled = false;
                chip.classList.remove('chip-booked');
                chip.title = '';
            }
        });
    } catch (err) {
        console.error('Error checking availability (model-based):', err);
        // On error, enable all slots (fail open)
        resetChips();
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
    // NOTE: carId input now stores the MODEL KEY, not a single car_id
    const modelKey = document.getElementById('carId').value;
    
    if (!bookingDateVal || !timeSlotVal) {
        alert('Please select schedule (date and time) before submitting.');
        return;
    }

    if (!modelKey) {
        alert('Please select a car before submitting.');
        return;
    }

    // Resolve the selected MODEL into a specific free car_id for this date + time slot
    const carsForModel = getCarsForModelKey(modelKey);
    if (!carsForModel || carsForModel.length === 0) {
        alert('The selected car model is not available in inventory. Please refresh and try again.');
        return;
    }

    let assignedCarId = null;

    try {
        const carIds = carsForModel.map((c) => c.id).filter((id) => typeof id === 'number' || typeof id === 'string');
        const idList = carIds.join(',');

        // Fetch bookings for ALL cars of this model for this date + slot
        const conflictCheck = await fetch(
            `${SUPABASE_URL}/rest/v1/bookings?car_id=in.(${idList})&booking_date=eq.${bookingDateVal}&time_slot=eq.${encodeURIComponent(
                timeSlotVal
            )}&select=car_id`,
            {
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );

        if (!conflictCheck.ok) {
            const errorText = await conflictCheck.text();
            console.error('Conflict check error (model-based):', {
                status: conflictCheck.status,
                error: errorText
            });
            throw new Error(`Failed to check for conflicts: ${errorText}`);
        }

        const conflicts = await conflictCheck.json();
        const bookedCarIds = new Set(conflicts.map((row) => row.car_id));

        // Pick the first physical car of this model that is NOT booked for this slot
        const freeCar = carsForModel.find((car) => !bookedCarIds.has(car.id));

        if (!freeCar) {
            // All physical cars of this model are busy in this slot
            const anyCar = carsForModel[0];
            const modelLabel = `${anyCar.car_make} ${anyCar.car_model} (${anyCar.car_variant})`;
            alert(
                `All ${carsForModel.length} cars of this model are already booked for ${timeSlotVal} on ${bookingDateVal}.\n\nModel: ${modelLabel}\n\nPlease choose a different time slot or car model.`
            );
            document.getElementById('scheduleModal').classList.remove('hidden');
            return;
        }

        assignedCarId = freeCar.id;

        // Also ensure the selected consultant is not booked on ANY car for this date and slot
        const consultantName = document.getElementById('consultantName').value;
        if (consultantName) {
            const consultantConflict = await fetch(
                `${SUPABASE_URL}/rest/v1/bookings?consultant_name=eq.${encodeURIComponent(
                    consultantName
                )}&booking_date=eq.${bookingDateVal}&time_slot=eq.${encodeURIComponent(timeSlotVal)}&select=id`,
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
                alert(
                    'This consultant is already booked for this time slot on another car. Please choose a different consultant or slot.'
                );
                document.getElementById('scheduleModal').classList.remove('hidden');
                return;
            }
        }
    } catch (err) {
        console.error('Error checking conflicts (model-based):', err);
        // Continue anyway, but warn user
        if (!confirm('Could not verify slot availability. Do you want to proceed anyway?')) {
            return;
        }
        // As a fallback, just pick the first car for this model
        assignedCarId = carsForModel[0].id;
    }

    if (!assignedCarId) {
        alert('Could not assign a specific car for this model. Please try again.');
        return;
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
        car_id: Number(assignedCarId)
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
    const carVin = document.getElementById('carVin').value.trim();
    const carYear = document.getElementById('carYear').value;

    const payload = {
        car_make: carMake,
        car_model: carModel,
        car_variant: carVariant,
        vin: carVin,
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

// Delete car from Supabase (Manage Cars page)
// NOTE: This will also delete ALL bookings for this car (past + future)
async function deleteCar(carId, carName) {
    console.log('Delete car called:', { carId, carName });

    const confirmed = confirm(
        `Are you sure you want to delete "${carName}" from the inventory?\n\n` +
            `This will also delete ALL bookings linked to this car (past and future).`
    );
    if (!confirmed) {
        console.log('Deletion cancelled by user');
        return;
    }

    if (!carId) {
        alert('Error: Car ID is missing. Cannot delete.');
        console.error('Car ID is missing');
        return;
    }

    try {
        // First delete all bookings for this car_id
        console.log('Deleting all bookings for car before deleting car row...', carId);
        const deleteBookingsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/bookings?car_id=eq.${carId}`,
            {
                method: 'DELETE',
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );

        if (!deleteBookingsRes.ok && deleteBookingsRes.status !== 204) {
            const text = await deleteBookingsRes.text();
            console.error('Error deleting bookings for car:', {
                status: deleteBookingsRes.status,
                statusText: deleteBookingsRes.statusText,
                body: text
            });
            alert('Could not delete bookings for this car. Please check console (F12) for details.');
            return;
        }

        console.log('Bookings deleted (or none existed). Now deleting car row...');

        const res = await fetch(`${SUPABASE_URL}/rest/v1/cars?id=eq.${carId}`, {
            method: 'DELETE',
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        console.log('Delete car response status:', res.status, res.statusText);

        if (res.status === 204 || res.status === 200) {
            // Clear dropdown selection if the deleted car was selected
            const selectedCar = document.getElementById('selectedCar');
            const carIdInput = document.getElementById('carId');
            if (selectedCar && selectedCar.value === String(carId)) {
                selectedCar.value = '';
            }
            if (carIdInput && carIdInput.value === String(carId)) {
                carIdInput.value = '';
            }

            const manageCarsList = document.getElementById('manageCarsList');
            if (manageCarsList) {
                manageCarsList.innerHTML = '<p class="manage-cars-empty">Refreshing...</p>';
            }

            await loadCars();
            await loadAvailabilityTable();

            alert(`"${carName}" has been deleted from inventory.`);
            return;
        }

        if (!res.ok) {
            const text = await res.text();
            console.error('Error deleting car - Full response:', {
                status: res.status,
                statusText: res.statusText,
                body: text
            });

            if (res.status === 401 || res.status === 403) {
                alert(
                    `Permission denied (${res.status}).\n\n` +
                        `Please run the SQL script "add_delete_permissions.sql" in Supabase SQL Editor to enable DELETE permissions.\n\n` +
                        `Check browser console for details.`
                );
            } else if (res.status === 404) {
                alert(`Car not found (${res.status}). The car may have already been deleted.`);
            } else {
                alert(
                    `Error deleting car (Status: ${res.status}).\n\n` +
                        `Please check browser console (F12) for details.\n\n` +
                        `Error: ${text.substring(0, 200)}`
                );
            }
        }
    } catch (err) {
        console.error('Unexpected error deleting car:', err);
        alert('Unexpected error while deleting car. Please try again.');
    }
}
