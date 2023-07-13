const getFeeTierPercentage = (tier) => {
    if (tier === "100") return 0.01 / 100;
    if (tier === "500") return 0.05 / 100;
    if (tier === "3000") return 0.3 / 100;
    if (tier === "10000") return 1 / 100;
    return 0;
};

module.exports = { getFeeTierPercentage };