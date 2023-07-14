const { getPoolFromId, getPoolTicks, getPriceChart, getVolumn24H } = require("./repos/uniswap")
const { getPrice } = require("./setting/PriceRange")
const { getTokenAmountsFromDepositAmounts, getSqrtPriceX96, getLiquidityForAmounts, getTickFromPrice, calculateFee } = require("./utils/liquidityMath")
const bn = require("bignumber.js");

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

const main = async () => {
    const calculateLiquidity = (ticks, currentTick) => {
        if (ticks.length <= 1) return new bn(0)
        let liquidity = new bn(0)
        for (let i = 0; i < ticks.length - 1; ++i) {
            liquidity = liquidity.plus(new bn(ticks[i].liquidityNet))
    
            let lowerTick = Number(ticks[i].tickIdx)
            let upperTick = Number(ticks[i + 1].tickIdx)
    
            if (lowerTick <= currentTick && currentTick <= upperTick) {
                break
            }
        }
    
        return liquidity
    }

    const poolID = "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36"
    const pool = await getPoolFromId(poolID);
    const token0 = pool.token0;
    const token1 = pool.token1;
    const poolTicks = await getPoolTicks(poolID);
    const token0PriceChart = await getPriceChart(token0.id);
    const token1PriceChart = await getPriceChart(token1.id);
    const volume24H = await getVolumn24H(pool.id);

    const price = getPrice(token0PriceChart, token1PriceChart, pool);
    const P = price.currentPrice;
    const Pl = price.priceRangeValue[0];
    const Pu = price.priceRangeValue[1];
    const priceUSDX = token1PriceChart.currentPriceUSD || 1;
    const priceUSDY = token0PriceChart.currentPriceUSD || 1;
    const targetAmounts = 1000;

    const { amount0, amount1 } = getTokenAmountsFromDepositAmounts(
        P,
        Pl,
        Pu,
        priceUSDX,
        priceUSDY,
        targetAmounts
    );

    const sqrtRatioX96 = getSqrtPriceX96(
        P,
        pool.token0.decimals || "18",
        pool.token1.decimals || "18"
    );
    const sqrtRatioAX96 = getSqrtPriceX96(
        Pl,
        pool.token0.decimals || "18",
        pool.token1.decimals || "18"
    );
    const sqrtRatioBX96 = getSqrtPriceX96(
        Pu,
        pool.token0.decimals || "18",
        pool.token1.decimals || "18"
    );

    const deltaL = getLiquidityForAmounts(
        sqrtRatioX96,
        sqrtRatioAX96,
        sqrtRatioBX96,
        amount0,
        Number(pool.token1.decimals || 18),
        amount1,
        Number(pool.token0.decimals || 18)
    );

    let currentTick = getTickFromPrice(
        P,
        pool.token0.decimals || "18",
        pool.token1.decimals || "18"
    );

    const L = calculateLiquidity(poolTicks || [], currentTick);
    const feeTier = pool.feeTier || "";

    let fee = calculateFee(deltaL, L, volume24H, feeTier);
    if (P < Pl || P > Pu) fee = 0;
    
    let yearFee = fee * 365;
    let APR = yearFee / targetAmounts * 100;
    console.log(`APR: ${APR.toFixed(2)}%`)
}

main();