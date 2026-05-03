import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    
    const checkMobile = () => {
      setIsMobile(mql.matches)
    }
    
    // Initial check in an async manner to appease the linter
    const timeoutId = setTimeout(checkMobile, 0)
    
    mql.addEventListener("change", checkMobile)
    return () => {
      mql.removeEventListener("change", checkMobile)
      clearTimeout(timeoutId)
    }
  }, [])

  return isMobile
}
