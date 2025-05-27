// pay.js

// Function to fetch a random driver from the backend
async function fetchRandomDriver() {
    try {
        const response = await fetch('/api/drivers/random');
        if (!response.ok) throw new Error('Failed to fetch driver');
        return await response.json();
    } catch (error) {
        console.error('Error fetching random driver:', error);
        // Fallback to sample data if API fails
        const sampleDrivers = [
            { driver_id: 1, driver_name: "Vijay", license_number: "TN01A1234", rating: 4.5 },
            { driver_id: 2, driver_name: "Ajith", license_number: "TN02B5678", rating: 4.7 },
            { driver_id: 3, driver_name: "Simbu", license_number: "TN03C9012", rating: 4.2 },
            { driver_id: 4, driver_name: "Kamal", license_number: "TN04D3456", rating: 4.9 },
            { driver_id: 5, driver_name: "Rajini", license_number: "TN05E7890", rating: 5.0 }
        ];
        return sampleDrivers[Math.floor(Math.random() * sampleDrivers.length)];
    }
}

// Function to fetch distance between locations
async function fetchDistance(pickup, dropoff) {
    try {
        const response = await fetch(`/api/locations/distance?pickup=${encodeURIComponent(pickup)}&dropoff=${encodeURIComponent(dropoff)}`);
        if (!response.ok) throw new Error('Failed to fetch distance');
        return await response.json();
    } catch (error) {
        console.error('Error fetching distance:', error);
        // Fallback to a default distance if API fails
        return { distance_km: 5 }; // Default to 5km if we can't calculate
    }
}

// Function to update driver info in the UI
function updateDriverInfo(driver) {
    if (!driver) return;

    // Update driver name
    const driverNameElement = document.querySelector('.driver-name');
    if (driverNameElement) driverNameElement.textContent = driver.driver_name;

    // Update license plate
    const licensePlateElement = document.querySelector('.license-plate');
    if (licensePlateElement) licensePlateElement.textContent = driver.license_number;

    // Update rating stars
    const ratingElement = document.querySelector('.rating');
    if (ratingElement) {
        ratingElement.innerHTML = '';
        const fullStars = Math.floor(driver.rating);
        const hasHalfStar = driver.rating % 1 >= 0.5;

        // Add full stars
        for (let i = 0; i < fullStars; i++) {
            ratingElement.innerHTML += '<i class="fas fa-star"></i>';
        }

        // Add half star if needed
        if (hasHalfStar) {
            ratingElement.innerHTML += '<i class="fas fa-star-half-alt"></i>';
        }

        // Add empty stars if needed (to always show 5 stars)
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        for (let i = 0; i < emptyStars; i++) {
            ratingElement.innerHTML += '<i class="far fa-star"></i>';
        }

        // Add rating text
        ratingElement.innerHTML += `<span>${driver.rating.toFixed(1)}</span>`;
    }

    // Update avatar initials
    const avatarElement = document.querySelector('.avatar');
    if (avatarElement) {
        const names = driver.driver_name.split(' ');
        let initials = names[0].charAt(0).toUpperCase();
        if (names.length > 1) {
            initials += names[names.length - 1].charAt(0).toUpperCase();
        }
        avatarElement.textContent = initials;
    }
}

// pay.js

// ... (keep all existing functions until updateFareAndDistance)

// Function to update fare, distance, and eco impact
async function updateRideDetails(pickup, dropoff) {
    try {
        const distanceData = await fetchDistance(pickup, dropoff);
        const distance = distanceData.distance_km;
        
        // Update fare estimate
        const baseFare = 50; // ₹50 base fare
        const perKmRate = 10; // ₹10 per km
        const minFare = Math.round(baseFare + (distance * perKmRate * 0.9));
        const maxFare = Math.round(baseFare + (distance * perKmRate * 1.1));
        
        document.querySelector('.fare-range').textContent = `₹${minFare} - ₹${maxFare}`;
        
        // Update distance display
        document.querySelector('.calculated-distance').textContent = `${distance.toFixed(1)} km`;
        
        // Update eco impact
        const petrolSaved = (distance * 0.1).toFixed(1);
        const savings = (distance * 5).toFixed(0);
        const peopleSharing = Math.max(2, Math.min(5, Math.floor(distance / 2)));
        
        document.querySelector('.metric-value:nth-of-type(1)').textContent = `${petrolSaved} L`;
        document.querySelector('.metric-value:nth-of-type(2)').textContent = `₹${savings}`;
        document.querySelector('.metric-value:nth-of-type(3)').textContent = peopleSharing;
        
        // Update driver distance display
        document.querySelector('.driver-status strong').textContent = `${distance.toFixed(1)} km`;
        
    } catch (error) {
        console.error('Error updating ride details:', error);
        // Fallback values
        document.querySelector('.calculated-distance').textContent = '5 km (default)';
        document.querySelector('.fare-range').textContent = '₹100 - ₹150';
    }
}

// Main initialization
document.addEventListener("DOMContentLoaded", async function () {
    if (window.location.pathname.includes('/pay.html')) {
        // Update driver info
        const driver = await fetchRandomDriver();
        updateDriverInfo(driver);

        // Get URL params
        const urlParams = new URLSearchParams(window.location.search);
        const pickup = urlParams.get('pickup');
        const dropoff = urlParams.get('dropoff');
        const rideId = urlParams.get('ride_id');

        // Update location displays
        if (pickup) {
            document.getElementById('pickup-location').textContent = pickup;
            document.getElementById('pickup-address').textContent = pickup;
        }
        if (dropoff) {
            document.getElementById('dropoff-location').textContent = dropoff;
            document.getElementById('dropoff-address').textContent = dropoff;
        }

        // Calculate and display all ride details
        if (pickup && dropoff) {
            await updateRideDetails(pickup, dropoff);
        }

        // Update OTP
        if (rideId) {
            document.querySelector('.otp-code').textContent = (parseInt(rideId) % 9000 + 1000).toString();
        }
    }
});