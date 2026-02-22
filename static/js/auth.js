(function() {
    var originalFetch = window.fetch;

    window.fetch = function() {
        return originalFetch.apply(this, arguments).then(function(response) {
            if (response.status === 401) {
                window.location.href = '/login';
            }
            return response;
        });
    };
})();
