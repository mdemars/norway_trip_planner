// ============================================================================
// Calendar Functions
// ============================================================================

(function() {
    const App = window.TripApp;

function renderCalendar() {
    // Filter to only stops with dates (exclude trip start/end locations)
    const stopsWithDates = App.stops.filter(stop => stop.start_date && stop.end_date);

    if (!stopsWithDates || stopsWithDates.length === 0) {
        document.getElementById('calendar').innerHTML = `
            <div class="calendar-placeholder">
                <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <p>${t('calendar.addStopsToSee')}</p>
            </div>
        `;
        return;
    }

    // Find the date range of the trip
    const allDates = stopsWithDates.flatMap(stop => [new Date(stop.start_date), new Date(stop.end_date)]);
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));

    // Generate list of months to display
    const months = [];
    const currentMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const lastMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

    while (currentMonth <= lastMonth) {
        months.push(new Date(currentMonth));
        currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    // Build calendar HTML
    let calendarHTML = '<div class="calendar-months">';

    months.forEach(monthDate => {
        calendarHTML += renderMonth(monthDate);
    });

    // Add legend (only for stops with dates)
    calendarHTML += `<div class="calendar-legend"><h4>${t('calendar.stops')}</h4><div class="calendar-legend-items">`;
    stopsWithDates.forEach((stop, index) => {
        const color = App.STOP_COLORS[index % App.STOP_COLORS.length];
        calendarHTML += `
            <div class="calendar-legend-item">
                <div class="calendar-legend-color" style="background: ${color};"></div>
                <div class="calendar-legend-text" title="${escapeHtml(stop.name)}">${escapeHtml(stop.name)}</div>
            </div>
        `;
    });
    calendarHTML += '</div></div>';

    calendarHTML += '</div>';

    document.getElementById('calendar').innerHTML = calendarHTML;
}

function renderMonth(monthDate) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    // Get localized month name
    const monthNames = [
        t('calendar.months.january'), t('calendar.months.february'), t('calendar.months.march'),
        t('calendar.months.april'), t('calendar.months.may'), t('calendar.months.june'),
        t('calendar.months.july'), t('calendar.months.august'), t('calendar.months.september'),
        t('calendar.months.october'), t('calendar.months.november'), t('calendar.months.december')
    ];
    const monthName = `${monthNames[month]} ${year}`;

    // Get first and last day of the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Get day of week for first day (0 = Sunday)
    const firstDayOfWeek = firstDay.getDay();

    // Localized weekday names
    const weekdays = [
        t('calendar.weekdays.sun'), t('calendar.weekdays.mon'), t('calendar.weekdays.tue'),
        t('calendar.weekdays.wed'), t('calendar.weekdays.thu'), t('calendar.weekdays.fri'),
        t('calendar.weekdays.sat')
    ];

    // Build calendar grid
    let html = `
        <div class="calendar-month">
            <div class="calendar-header">
                <h3>${monthName}</h3>
            </div>
            <div class="calendar-weekdays">
                ${weekdays.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
            </div>
            <div class="calendar-days">
    `;

    // Add empty cells for days before the first day of the month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const prevMonthStartDay = prevMonthLastDay - firstDayOfWeek + 1;
    for (let i = 0; i < firstDayOfWeek; i++) {
        const dayNum = prevMonthStartDay + i;
        html += `<div class="calendar-day other-month"><div class="calendar-day-number">${dayNum}</div></div>`;
    }

    // Add days of the current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const currentDate = new Date(year, month, day);
        const stopsOnDay = getStopsForDay(currentDate);

        html += `<div class="calendar-day">`;
        html += `<div class="calendar-day-number">${day}</div>`;

        if (stopsOnDay.length > 0) {
            html += `<div class="calendar-day-stops">`;
            stopsOnDay.forEach(({ stop, index, isStart, isEnd }) => {
                const color = App.STOP_COLORS[index % App.STOP_COLORS.length];

                // Show label only on start day
                if (isStart) {
                    html += `
                        <div class="calendar-stop-label" style="background: ${color}; cursor: pointer;" title="${escapeHtml(stop.name)}" onclick="handleCalendarStopClick(${stop.id})">
                            ${escapeHtml(stop.name)}
                        </div>
                    `;
                } else {
                    html += `<div class="calendar-stop-bar" style="background: ${color}; cursor: pointer;" title="${escapeHtml(stop.name)}" onclick="handleCalendarStopClick(${stop.id})"></div>`;
                }
            });
            html += `</div>`;
        }

        html += `</div>`;
    }

    // Add empty cells for days after the last day of the month
    const lastDayOfWeek = lastDay.getDay();
    const remainingDays = 6 - lastDayOfWeek;
    for (let i = 1; i <= remainingDays; i++) {
        html += `<div class="calendar-day other-month"><div class="calendar-day-number">${i}</div></div>`;
    }

    html += `</div></div>`;

    return html;
}

function getStopsForDay(date) {
    const stopsOnDay = [];

    // Filter to only stops with dates (exclude trip start/end locations)
    const stopsWithDates = App.stops.filter(stop => stop.start_date && stop.end_date);

    stopsWithDates.forEach((stop, index) => {
        const startDate = new Date(stop.start_date);
        const endDate = new Date(stop.end_date);

        // Set time to midnight for accurate date comparison
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        if (checkDate >= startDate && checkDate <= endDate) {
            stopsOnDay.push({
                stop,
                index,
                isStart: checkDate.getTime() === startDate.getTime(),
                isEnd: checkDate.getTime() === endDate.getTime()
            });
        }
    });

    return stopsOnDay;
}

function handleCalendarStopClick(stopId) {
    // Collapse all stops
    document.querySelectorAll('.stop-card').forEach(card => {
        card.classList.add('collapsed');
    });

    // Expand the clicked stop
    const stopCard = document.querySelector(`.stop-card[data-stop-id="${stopId}"]`);
    if (stopCard) {
        stopCard.classList.remove('collapsed');

        // Scroll to the stop
        setTimeout(() => {
            stopCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
}

// Expose on App namespace
App.renderCalendar = renderCalendar;
App.renderMonth = renderMonth;
App.getStopsForDay = getStopsForDay;
App.handleCalendarStopClick = handleCalendarStopClick;

// Expose on window for inline onclick handlers and global access
window.renderCalendar = App.renderCalendar;
window.handleCalendarStopClick = App.handleCalendarStopClick;
})();
