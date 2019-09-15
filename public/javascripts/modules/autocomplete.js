function autocomplete(input, latInput, lngInput) {
    if(!input) return; // skip this running this fn if no input on page
    const dropdown = new google.maps.places.Autocomplete(input);

    // .addListener() is google's way of adding an event listener
    dropdown.addListener('place_changed', () => {
        const place = dropdown.getPlace();
        latInput.value = place.geometry.location.lat()
        lngInput.value = place.geometry.location.lng()
    });

    // if someone hits enter on address field, dont submit form
    input.on('keydown', (e) => {
        if(e.keyCode === 13) e.preventDefault();
    })
}

export default autocomplete;