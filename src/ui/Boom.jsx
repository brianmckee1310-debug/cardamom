import React from 'react'

/**
 * Last line of defence. Without this, one bad recipe or one failed chunk download turns the
 * whole app into a white screen mid-cook, which is the worst thing that can happen to someone
 * standing at the stove. A boundary turns that into a message and a way out.
 *
 * `reset` is what the surrounding screen should do to get back to safety; `where` names the
 * part that failed so the rest of the app can keep working.
 */
export default class Boom extends React.Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) { console.error('[cardamom]', this.props.where || 'app', err, info?.componentStack) }
  render() {
    if (!this.state.err) return this.props.children
    const chunk = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(this.state.err?.message || '')
    return (
      <div className={`boom ${this.props.overlay ? 'overlay' : ''}`} role="alert">
        <h3>{chunk ? 'That part could not load' : 'Something went wrong here'}</h3>
        <p>
          {chunk
            ? 'The app was updated while it was open, so this screen is out of date. Reloading will fix it — nothing has been lost.'
            : 'Your recipes are safe on this phone. Backing out of this screen usually clears it.'}
        </p>
        <div className="rowline">
          {this.props.reset && !chunk && <button className="btn grow" onClick={() => { this.setState({ err: null }); this.props.reset() }}>Go back</button>}
          <button className="btn primary grow" onClick={() => location.reload()}>Reload Cardamom</button>
        </div>
        <details><summary>Details</summary><pre>{String(this.state.err?.message || this.state.err)}</pre></details>
      </div>
    )
  }
}
