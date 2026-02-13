import {
  getData,
  getHistory,
  getLang,
  getLastStep,
  hasData,
} from "../../wizards/state-helpers"

describe("wizard state helpers", () => {
  test("getLang returns fallback", () => {
    expect(getLang(undefined)).toBe("en")
    expect(getLang({ lang: "ru" } as any)).toBe("ru")
  })

  test("getData throws when missing", () => {
    expect(() => getData({} as any)).toThrow("STATE_DATA_UNDEFINED")
  })

  test("hasData guard", () => {
    const state = { data: { foo: "bar" } } as any
    expect(hasData(state)).toBe(true)
    expect(hasData({} as any)).toBe(false)
  })

  test("history helpers", () => {
    expect(getHistory({ history: ["A", "B"] } as any)).toEqual(["A", "B"])
    expect(getHistory({} as any)).toEqual([])
    expect(getLastStep({ history: ["A", "B"] } as any)).toBe("B")
  })
})
