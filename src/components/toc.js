import React from "react"

const Toc = ({ toc }) => {
  return (
    <aside className="toc">
      <div dangerouslySetInnerHTML={{ __html: toc }}></div>
    </aside>
  )
}

export default Toc
