import { spawn } from 'child_process'
import moment from 'moment'

export function log (log: string) {
  console.log(moment().format('DD/MM/YYYY - hh:mm:ss #'), log)
}

export async function sleep (msInterval: number) {
  return new Promise(resolve => setTimeout(resolve, msInterval))
}

export async function execProcess (command: string, args: string[]) : Promise<void> {
  const child = spawn(command, args)
  child.stdout.on('data', function (data) {
    process.stdout.write(data.toString())
  })
  child.stderr.on('data', function (data) {
    process.stderr.write(data.toString())
  })

  return new Promise((resolve, reject) => {
    child.on('close', function (code) {
      if (code === 1) {
        reject(new Error('Process exited with error code 1'))
      } else {
        resolve()
      }
    })
  })
}
