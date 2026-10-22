// Status-bar sample. Items render from the manifest until the worker first
// runs; afterwards `statusBar.update` layers runtime state on top of them.
export default function activate(orca) {
  let timer = null
  let percent = 0

  const update = (patch) => orca.host.call('statusBar.update', { id: 'build', ...patch })

  const finish = async (text, tone) => {
    clearInterval(timer)
    timer = null
    await update({
      text,
      spinner: false,
      progress: null,
      menu: null,
      badge: { text: tone === 'success' ? 'ok' : 'stop', tone }
    })
  }

  // Why return before the build ends: worker commands have a timeout; host
  // calls during the build keep the worker from being reaped as idle.
  orca.commands.register('start-build', async () => {
    if (timer) {
      return { started: false }
    }
    percent = 0
    await update({
      text: 'Build: 0%',
      spinner: true,
      progress: { value: 0 },
      badge: null,
      menu: [{ title: 'Cancel build', command: 'cancel-build' }]
    })
    timer = setInterval(() => {
      percent += 10
      if (percent >= 100) {
        void finish('Build: done', 'success')
        return
      }
      void update({ text: `Build: ${percent}%`, progress: { value: percent } })
    }, 500)
    return { started: true }
  })

  orca.commands.register('cancel-build', async () => {
    if (timer) {
      await finish('Build: cancelled', 'warning')
    }
    return { cancelled: true }
  })
}
