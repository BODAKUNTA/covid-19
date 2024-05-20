const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const jwtToken = require('jsonwebtoken')
const bcrypt = require('bcrypt')

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

const app = express()
app.use(express.json())

let database = null

const initializingServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server running at http://localhost:3000')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializingServer()

const converStateObjectsToResponseObjcets = dbObjects => {
  return {
    stateId: dbObjects.state_id,
    stateName: dbObjects.state_name,
    population: dbObjects.population,
  }
}

const converDistrictObjectsToResponseObjcets = dbObjects => {
  return {
    districtId: dbObjects.district_id,
    districtName: dbObjects.district_name,
    stateId: dbObjects.state_id,
    cases: dbObjects.cases,
    cured: dbObjects.cured,
    active: dbObjects.active,
    deaths: dbObjects.deaths,
  }
}

function authenticationToken(request, response, next) {
  let jwtToken;  
  const authHeader = request.headers['authorization']
  console.lgo(authHeader)
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(400)
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

app.post('/login', async (request, response) => {
  const {username, password} = request.body
  const selectQuery = `SELECT * FROM user WHERE username = ${username}`
  const databaseUser = await database.get(selectQuery)

  if (databaseUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password,
    )
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid Password')
    }
  }
})

app.get('/states/', authenticationToken, async (request, response) => {
  const getStatesQuery = `
  SELECT
  *
  FROM
  state
  `
  const statesArray = await database.all(getStatesQuery)
  response.send(
    statesArray.map(each => converStateObjectsToResponseObjcets(each)),
  )
})

app.get('/states/:stateId/', authenticationToken, async (request, response) => {
  const {stateId} = request.params
  const getStatesQuery = `
  SELECT
  *
  FROM
  state
  WHERE
  state_id = ${stateId}
  `
  const state = await database.get(getStatesQuery)
  response.send(converStateObjectsToResponseObjcets(state))
})

app.get(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const getStatesQuery = `
  SELECT
  *
  FROM
  state
  WHERE
  district_id = ${districtId}
  `
    const district = await database.get(getStatesQuery)
    response.send(converDistrictObjectsToResponseObjcets(district))
  },
)

app.post('/districts/', authenticationToken, async (request, response) => {
  const {stateId, districtName, cases, cured, active, deaths} = response.body
  const postDistrictQuery = `
  INSERT INTO 
  district (state_id, district_name, cases, cured, active, deaths)
  VALUES (
    ${stateId}, 
    ${districtName}, 
    ${cases}, 
    ${cured}, 
    ${active}, 
    ${deaths}
  )
  `
  await database.run(postDistrictQuery)
  response.send('District Successfully Added')
})

app.delete(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `
  SELECT
  *
  FROM
  state
  WHERE
  district_id = ${districtId}
  `
    const district = await database.get(deleteDistrictQuery)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateQuery = `
    UPDATE
    district
    SET 
    district_name = '${districtName}',
    state_id = '${stateId}',
    cases = '${cases}',
    cured = '${cured}',
    active = '${active}',
    deaths = '${deaths}'
    `
    await database.run(updateQuery)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats',
  authenticationToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStateStatsQuery = `
  SELECT
    SUM(cases),
    SUM(cured),
    SUM(active),
    SUM(deaths)
  FROM
   state
  WHERE
   state_id = ${stateId}
  `
    const stats = await database.get(getStateStatsQuery)
    response.send({
      totalCases: stats['SUM(cases)'],
      totalCured: stats['SUM(cured)'],
      totalActive: stats['SUM(active)'],
      totalDeaths: stats['SUM(deaths)'],
    })
  },
)

module.exports = app
