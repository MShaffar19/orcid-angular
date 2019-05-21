import * as fs from 'fs'
import { parseString, Builder } from 'xml2js'
import { Observable, from, of, defer } from 'rxjs'
import {
  map,
  tap,
  concatAll,
  combineAll,
  mergeMap,
  switchMap,
  reduce,
} from 'rxjs/operators'

const propertiesToJSON = require('properties-to-json')
const axios = require('axios')

const baseGithubTranslationFilesURL = [
  'https://raw.githubusercontent.com/ORCID/ORCID-Source/master/orcid-core/src/main/resources/i18n/about_',
  'https://raw.githubusercontent.com/ORCID/ORCID-Source/master/orcid-core/src/main/resources/i18n/messages_',
  'https://raw.githubusercontent.com/ORCID/ORCID-Source/master/orcid-core/src/main/resources/i18n/admin_',
  'https://raw.githubusercontent.com/ORCID/ORCID-Source/master/orcid-core/src/main/resources/i18n/email_',
  'https://raw.githubusercontent.com/ORCID/ORCID-Source/master/orcid-core/src/main/resources/i18n/identifiers_',
  'https://raw.githubusercontent.com/ORCID/ORCID-Source/master/orcid-core/src/main/resources/i18n/javascript_',
  'https://raw.githubusercontent.com/ORCID/ORCID-Source/master/orcid-core/src/main/resources/i18n/test_messages_',
]

const languages = [
  {
    code: 'ar',
  },
  {
    code: 'ca',
  },
  {
    code: 'cs',
  },
  {
    code: 'en',
  },
  {
    code: 'es',
  },
  {
    code: 'fr',
  },
  {
    code: 'it',
  },
  {
    code: 'ja',
  },
  {
    code: 'ko',
  },
  {
    code: 'lr',
  },
  {
    code: 'pt',
  },
  {
    code: 'rl',
  },
  {
    code: 'ru',
  },
  {
    code: 'uk',
  },
  {
    code: 'xx',
  },
  {
    code: 'zh_CN',
  },
  {
    code: 'zh_TW',
  },
]

const reportFile: {
  language: any
} = {
  language: {},
}

const stringReplacements = {
  '<br />': ' ',
}

// Read message file
readMessageFile('./src/locale/messages.xlf')
  // For each language generate a translation file
  .pipe(
    switchMap(file =>
      from(
        languages.map(language =>
          generateLanguageFile(language.code, language.code, deepCopy(file))
        )
      )
    )
  )
  // Generate the next translation file until the last one finish
  .pipe(concatAll())
  // Save the translation file
  .pipe(map(result => saveJsonAsXlf(result.file, result.saveCode)))
  // Waits until all translations are created
  .pipe(combineAll())
  // Save the translation log
  .pipe(mergeMap(() => saveJson(reportFile, 'translation.log')))
  // Start it all
  .subscribe()

function generateLanguageFile(code, saveCode, file) {
  return (
    from(
      baseGithubTranslationFilesURL.map(url =>
        getTranslationFileFromGithub(url, code)
      )
    )
      // Wait until all properties files where read
      .pipe(concatAll())
      // Reduces all the properties files in one list of files
      .pipe(
        reduce((acc: any[], value: {}) => {
          acc.push(value)
          return acc
        }, new Array())
      )
      // Transform the list of files in a key-value translation file
      .pipe(map(val => getProperties(val)))
      // Creates an XLF translation based on the properties
      .pipe(
        mergeMap(val =>
          setLanguagePropertiesToLanguageFile(file, val, saveCode)
        )
      )
      // Return the XLF to be saved
      .pipe(
        map(val => {
          return { file: val, saveCode: saveCode }
        })
      )
      // Report success
      .pipe(
        tap(() => {
          console.log(`The langue code '${code}' file was created`)
        })
      )
  )
}

function saveJsonAsXlf(json, name) {
  return of(
    new Promise((resolve, reject) => {
      const builder = new Builder()
      const xml = builder.buildObject(json)
      fs.writeFile('./src/locale/messages.' + name + '.xlf', xml, err => {
        if (err) {
          reject(err)
        }
        resolve()
      })
    })
  )
}

function saveJson(json, name) {
  return of(
    new Promise((resolve, reject) => {
      fs.writeFile(
        './src/locale/messages.' + name + '.json',
        JSON.stringify(reportFile, null, 2),
        function(err) {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        }
      )
    })
  )
}

function getProperties(response) {
  const propsText = {}
  response.forEach(data => {
    if (data && data.data) {
      Object.assign(propsText, propertiesToJSON(data.data))
    }
  })
  return propsText
}

function readMessageFile(path) {
  return new Observable(observer => {
    fs.readFile(path, 'utf8', (error, data) => {
      if (error) {
        observer.error(error)
      } else {
        observer.next(data)
        observer.complete()
      }
    })
  })
}

function setLanguagePropertiesToLanguageFile(data, propsText, saveCode) {
  return new Observable(observer => {
    parseString(data, (error, result) => {
      if (error) {
        observer.error(error)
      }
      result.xliff.file[0].unit.forEach(element => {
        if (propsText[element['$'].id]) {
          element.segment[0].target = []
          element.segment[0].target.push(
            translationTreatment(
              propsText[element['$'].id],
              element['$'].id,
              saveCode
            )
          )
          if ('en' === saveCode) {
            checkIfTranslationMatch(
              element['$'].id,
              element.segment[0].target[0],
              element.segment[0].source[0]
            )
          }
        } else {
          element.segment[0].target = element.segment[0].source
          translationNotFound(element['$'].id, saveCode)
        }
      })
      observer.next(result)
      observer.complete()
    })
  })
}

function deepCopy(json) {
  return JSON.parse(JSON.stringify(json))
}

function translationNotFound(id, saveCode) {
  if (!reportFile.language[saveCode]) {
    reportFile.language[saveCode] = {}
  }
  if (!reportFile.language[saveCode].notFound) {
    reportFile.language[saveCode].notFound = []
  }
  reportFile.language[saveCode].notFound.push(id)
}

function checkIfTranslationMatch(id, target, source) {
  if (typeof source !== 'string') {
    throw new Error(
      `Translation id "${id}" is not a string. Maybe the i18n attribute is in an HTML tag with nested tags`
    )
  }
  const treatedSource = source
    .replace('\n', '')
    .replace('\r', '')
    .replace(/\s\s+/g, ' ')
    .trim()
  if (target !== treatedSource) {
    reportTranslationNotMatch(id, target, treatedSource)
  }
}

function reportTranslationNotMatch(id, textOnTemplate, textOnProperty) {
  if (!reportFile.language['en']) {
    reportFile.language['en'] = {}
  }
  if (!reportFile.language['en'].unmatch) {
    reportFile.language['en'].unmatch = []
  }
  reportFile.language['en'].unmatch.push({ id, textOnTemplate, textOnProperty })
}

function getTranslationFileFromGithub(baseUrl, code) {
  return from(
    axios.get(baseUrl + code + '.properties').catch(error => {})
  ).pipe(
    map(result => {
      if (result) {
        return result
      } else {
        console.log('Unexisting language fie: ' + baseUrl + code)
        if (!reportFile.language[code]) {
          reportFile.language[code] = {}
        }
        if (!reportFile.language[code].unexistingFiles) {
          reportFile.language[code].unexistingFiles = []
        }
        reportFile.language[code].unexistingFiles.push(
          baseUrl + code + '.properties'
        )
        return result
      }
    })
  )
}

function translationTreatment(translation, id, saveCode) {
  let replacement = JSON.parse(JSON.stringify(translation))
  Object.keys(stringReplacements).map((text, index) => {
    replacement = replacement.replace(text, stringReplacements[text])
  })
  reportTranslationTreatment(translation, replacement, saveCode, id)
  return replacement
}

function reportTranslationTreatment(translation, replacement, saveCode, id) {
  if (replacement !== translation) {
    if (!reportFile.language[saveCode]) {
      reportFile.language[saveCode] = {}
    }
    if (!reportFile.language[saveCode].changed) {
      reportFile.language[saveCode].changed = []
    }
    reportFile.language[saveCode].changed.push({
      id,
      translation,
      replacement,
    })
  }
}