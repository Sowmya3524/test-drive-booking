// Supabase config (fill these with your actual project values)
const SUPABASE_URL = 'https://iawznkckpbufhprkmufc.supabase.co'; // TODO: replace
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhd3pua2NrcGJ1ZmhwcmttdWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2Mzc0MjMsImV4cCI6MjA4MjIxMzQyM30.ce_cyJC18sL6JLnoEKpe6jBx5UZH6VQSmqnxtDrMaXA'; // TODO: replace

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    initializeEventListeners();
    setupHyderabadLocationSuggestions();
    loadCars(); // Load cars from Supabase
});

// Initialize all event listeners
function initializeEventListeners() {
    // Submit Booking button
    const submitBtn = document.getElementById('submitBookingBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitBooking);
    }

    // Year of manufacture - show/hide custom year input
    const yearSelect = document.getElementById('yearOfManufacture');
    const yearOtherInput = document.getElementById('yearOfManufactureOther');
    if (yearSelect && yearOtherInput) {
        yearSelect.addEventListener('change', function () {
            if (yearSelect.value === 'other') {
                yearOtherInput.style.display = 'block';
                yearOtherInput.required = true;
            } else {
                yearOtherInput.style.display = 'none';
                yearOtherInput.required = false;
                yearOtherInput.value = '';
            }
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
}

// Store cars data globally
let carsData = [];

// Load cars from Supabase
async function loadCars() {
    const carSelect = document.getElementById('selectedCar');
    if (!carSelect) return;

    try {
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
            return;
        }
        
        // Populate dropdown
        carSelect.innerHTML = '<option value="">Select a car</option>';
        carsData.forEach(car => {
            const option = document.createElement('option');
            option.value = car.id;
            option.textContent = `${car.car_make} ${car.car_model} (${car.car_variant}) - ${car.year_of_manufacture}`;
            carSelect.appendChild(option);
        });
        
        console.log(`✅ Loaded ${carsData.length} cars successfully`);
    } catch (err) {
        console.error('Error loading cars:', err);
        carSelect.innerHTML = '<option value="">❌ Error loading cars. Open browser console (F12) for details.</option>';
    }
}

// Update hidden car_id field
function updateCarId() {
    const selectedCar = document.getElementById('selectedCar');
    const carIdInput = document.getElementById('carId');
    if (selectedCar && carIdInput) {
        carIdInput.value = selectedCar.value || '';
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

    async function searchNominatimHyderabad(query) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&city=Hyderabad&countrycodes=in&q=${encodeURIComponent(
            query
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
        return data
            .map(r => r.display_name)
            .filter(name => typeof name === 'string')
            .slice(0, 8);
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

        // Start with local matches
        const localMatches = baseSuggestions.filter(loc =>
            loc.toLowerCase().includes(query)
        );

        renderSuggestions(localMatches.slice(0, 15));

        // Debounce remote search
        nominatimTimeoutId = setTimeout(async () => {
            try {
                const remote = await searchNominatimHyderabad(query);
                const combined = [...localMatches];

                remote.forEach(name => {
                    if (!combined.some(existing => existing.toLowerCase() === name.toLowerCase())) {
                        combined.push(name);
                    }
                });

                renderSuggestions(combined.slice(0, 25));
            } catch (e) {
                // On error, keep local matches only
                renderSuggestions(localMatches.slice(0, 15));
            }
        }, 350);
    });

    document.addEventListener('click', function (e) {
        if (!wrapper.contains(e.target)) {
            list.style.display = 'none';
        }
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

        closeModal();
    });
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
        const bookedSlots = bookings.map(b => b.time_slot);

        // Update time chips
        document.querySelectorAll('.chip-time').forEach(chip => {
            const slot = chip.getAttribute('data-time-slot');
            if (bookedSlots.includes(slot)) {
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
        car_id: Number(carId),
        kilometers: Number(document.getElementById('kilometers').value) || null
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
        })
        .catch((err) => {
            console.error('Error saving to Supabase:', err);
            alert('There was an error saving booking to Supabase. Check console for details.');
        });
}
