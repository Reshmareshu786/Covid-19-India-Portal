const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const pathDir = path.join(__dirname, 'covid19IndiaPortal.db')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const app = express()
app.use(express.json())
let db = null

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: pathDir,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is running on http://localhost:3000')
    })
  } catch (e) {
    console.log(`DB error : ${e.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user
    WHERE username = '${username}';`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const convertToResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

app.get('/states/', authenticateToken, async (request, response) => {
  const selectStatesQuery = `SELECT * FROM state;`
  const dbStates = await db.all(selectStatesQuery)
  const getStates = dbStates.map(eachState => {
    return convertToResponseObject(eachState)
  })
  response.send(getStates)
})

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const selectStatesQuery = `SELECT * FROM state
  WHERE state_id = '${stateId}';`
  const dbStates = await db.get(selectStatesQuery)
  response.send(convertToResponseObject(dbStates))
})

const convertToResponseObject2 = dbObject => {
  return {
    districtId : dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const createDistrictsQuery = `INSERT INTO district 
  (district_name,state_id,cases,cured,active,deaths)
  VALUES ('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');`
  await db.run(createDistrictsQuery)
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const selectDistrictQuery = `SELECT * FROM district
  WHERE district_id = ${districtId};`
    const dbDistrict = await db.get(selectDistrictQuery)
    response.send(convertToResponseObject2(dbDistrict))
  },
)

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `DELETE FROM district
  WHERE district_id = '${districtId}';`
    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDistrictQuery = `UPDATE district SET 
  district_name = '${districtName}',
  state_id = '${stateId}',
  cases = '${cases}',
  cured = '${cured}',
  active = '${active}',
  deaths = '${deaths}'
  WHERE district_id = ${districtId};`
    await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStatsQuery = `SELECT SUM(cases) AS totalCases,
  SUM(cured) AS totalCured,
  SUM(active) AS totalActive,
  SUM(deaths)AS totalDeaths
  FROM district
  WHERE state_id = ${stateId};`
    const dbStats = await db.get(getStatsQuery)
    response.send(dbStats)
  },
)

module.exports = app
