function getDate(time) {
    if (!time) {
        return new Date();
    }
    return new Date(time);
}
function getTime() {
    return getDate().getTime();
}
module.exports = {
    getDate,
    getTime
};