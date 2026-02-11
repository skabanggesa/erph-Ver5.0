// guru-utils.js

export function cardStyle(color) {
    return `background:${color}; box-shadow:0 4px 6px rgba(0,0,0,0.1);`;
}

export function generateWeekOptions() {
    let html = '';
    for(let i=1; i<=42; i++) {
        html += `<option value="${i}">Minggu ${i}</option>`;
    }
    return html;
}

export function getRandomItems(arr, n) {
    if(!Array.isArray(arr)) return [];
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
}

export function getDayName(num) {
    return ['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu'][num];
}