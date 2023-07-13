const { request, gql } = require('graphql-request');
const axios = require("axios");

const UNISWAP_V3_SUBGRAPH_URL = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3";

const queryUniswap = async (query, variables) => {
    if (variables) {
        // 쿼리 요청 및 응답 처리
        const response = await request(UNISWAP_V3_SUBGRAPH_URL, query, variables);
        return response;
    } else {
        // 쿼리 요청 및 응답 처리
        const response = await request(UNISWAP_V3_SUBGRAPH_URL, query);
        return response;
    }
}

const getVolumn24H = async poolAddress => {
    const { poolDayDatas } = await queryUniswap(gql`{
    poolDayDatas(skip: 1, first:3, orderBy: date, orderDirection: desc, where:{pool: "${poolAddress}"}) {
      volumeUSD
    }
  }`)

    const data = poolDayDatas.map(d => Number(d.volumeUSD));
    const volume24H = data.reduce((result, curr) => result + curr, 0) / data.length;

    return volume24H;
}

const getPoolTicks = async poolAddress => {
    const { ticks } = await queryUniswap(gql`{
    ticks(first: 1000, skip: 0, where: { poolAddress: "${poolAddress}" }, orderBy: tickIdx) {
      tickIdx
      liquidityNet
      price0
      price1
    }
  }`)

    return ticks
}

const getPriceChart = async (
    token,
    queryPeriod = "30"
) => {
    if (!token) return null

    if(token.id === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'){
        token.id = 'usd-coin';
    } else if(token.id === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'){
        token.id = 'weth'
    } else{
        token.id = token.id;
    }

    const marketChartRes = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${token.id}/market_chart?vs_currency=usd&days=${queryPeriod}`
    )
    const currentPriceRes = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${token.id}&vs_currencies=usd`
    )
    const prices = marketChartRes.data.prices.map(d => ({
        timestamp: d[0],
        value: d[1]
    }))

    return {
        tokenId: token.id,
        tokenName: token.name,
        currentPriceUSD: currentPriceRes.data[token.id].usd,
        prices
    }
}


const getPoolFromId = async (poolId) => {
    // 서브그래프 쿼리 정의
    const query = `
        query pool($poolId: ID!) {
            pool(id: $poolId) {
                id
                token0 {
                  id
                  symbol
                  name
                  decimals
                  derivedETH
                }
                token1 {
                  id
                  symbol
                  name
                  decimals
                  derivedETH
                }
                token0Price
                feeTier
                sqrtPrice
                liquidity
                tick
                ticks {
                    tickIdx
                    liquidityGross
                    liquidityNet
                }
                poolDayData {
                    date
                    volumeUSD
                }
            }
        }
      `;


    // 쿼리 변수 정의
    const variables = {
        poolId,
    };
    const { pool } = await queryUniswap(query, variables);

    // 쿼리 변수 정의
    return pool
}

module.exports = { getPoolFromId, getPoolTicks, getPriceChart, getVolumn24H };