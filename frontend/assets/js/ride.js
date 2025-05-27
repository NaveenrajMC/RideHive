// Initialize the Google Map and autocomplete inputs
function initMap() {
  const coimbatore = { lat: 11.0168, lng: 76.9558 };
  const map = new google.maps.Map(document.getElementById("map-container"), {
    center: coimbatore,
    zoom: 13,
    mapTypeControl: false,
    streetViewControl: false,
  });

  const pickupInput = document.getElementById("pickup");
  const dropoffInput = document.getElementById("dropoff");

  const pickupAutocomplete = new google.maps.places.Autocomplete(pickupInput);
  const dropoffAutocomplete = new google.maps.places.Autocomplete(dropoffInput);

  pickupAutocomplete.bindTo("bounds", map);
  dropoffAutocomplete.bindTo("bounds", map);

  const directionsService = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer();
  directionsRenderer.setMap(map);

  // Show route on map when locations change
  function calculateAndDisplayRoute() {
    const pickup = pickupInput.value;
    const dropoff = dropoffInput.value;

    if (!pickup || !dropoff) {
      directionsRenderer.set("directions", null);
      return;
    }

    directionsService.route(
      {
        origin: pickup,
        destination: dropoff,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status === "OK") {
          directionsRenderer.setDirections(response);
        } else {
          console.log("Directions request failed due to " + status);
        }
      }
    );
  }

  pickupAutocomplete.addListener("place_changed", calculateAndDisplayRoute);
  dropoffAutocomplete.addListener("place_changed", calculateAndDisplayRoute);
}

// Fallback if Google Maps fails to load
window.gm_authFailure = function () {
  console.log("Google Maps failed to load. Trying fallback...");
  document.getElementById("map-container").innerHTML = `
    <div class="map-error">
        <p>Google Maps could not be loaded. Trying alternative...</p>
    </div>
  `;
  initLeafletMap();
};

// Leaflet fallback map
function initLeafletMap() {
  try {
    const map = L.map("map-container").setView([11.0168, 76.9558], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    
    // Add basic markers if we have locations
    const rideForm = document.getElementById("rideForm");
    const pickup = rideForm.elements["pickup"].value;
    const dropoff = rideForm.elements["dropoff"].value;
    
    if (pickup) {
      // In a real app, you'd geocode these addresses
      L.marker([11.0168, 76.9558]).addTo(map)
        .bindPopup("Pickup: " + pickup);
    }
    
    if (dropoff) {
      // In a real app, you'd geocode these addresses
      L.marker([11.018, 76.965]).addTo(map)
        .bindPopup("Dropoff: " + dropoff);
    }
  } catch (e) {
    console.log("Leaflet also failed to load:", e);
    document.getElementById("map-container").innerHTML = `
      <div class="map-error">
          <p>Maps could not be loaded. Ride booking will still work.</p>
      </div>
    `;
  }
}

// Function to save ride data to backend
function saveRideData(pickup, dropoff) {
  return fetch("/api/ride", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pickup_location: pickup,
      drop_location: dropoff,
    }),
  })
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok");
      return response.json();
    })
    .then((data) => {
      console.log("Ride saved with ID:", data.location_id);
      return data;
    });
}

// Enhanced form submission handler
async function handleFormSubmit(event) {
  event.preventDefault();
  
  const pickup = document.getElementById("pickup").value.trim();
  const dropoff = document.getElementById("dropoff").value.trim();

  if (!pickup || !dropoff) {
    alert("Please enter both pickup and dropoff locations");
    return;
  }

  try {
    // Save to backend first
    const rideData = await saveRideData(pickup, dropoff);
    console.log("Ride data saved:", rideData);
    
    // Encode for URL
    const encodedPickup = encodeURIComponent(pickup);
    const encodedDropoff = encodeURIComponent(dropoff);
    
    // Redirect with parameters
    window.location.href = `pay.html?pickup=${encodedPickup}&dropoff=${encodedDropoff}&ride_id=${rideData.location_id}`;
    
  } catch (error) {
    console.error("Ride submission failed:", error);
    alert("Failed to book ride: " + error.message);
  }
}

// Main initialization
document.addEventListener("DOMContentLoaded", function () {
  // Initialize map (Google Maps with Leaflet fallback)
  if (typeof google !== "undefined") {
    try {
      initMap();
    } catch (e) {
      console.log("Google Maps initialization failed:", e);
      initLeafletMap();
    }
  } else {
    console.log("Google Maps not loaded, using Leaflet");
    initLeafletMap();
  }

  // Form submission
  const rideForm = document.getElementById("rideForm");
  rideForm.addEventListener("submit", handleFormSubmit);
  
  // Optional: Load any previously entered values
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('pickup')) {
    document.getElementById("pickup").value = decodeURIComponent(urlParams.get('pickup'));
  }
  if (urlParams.has('dropoff')) {
    document.getElementById("dropoff").value = decodeURIComponent(urlParams.get('dropoff'));
  }
});