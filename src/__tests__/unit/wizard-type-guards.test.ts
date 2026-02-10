import {
  getGroup,
  getLang,
  hasData,
  hasField,
  hasLang,
  safeData,
  safeMatch,
  safeState,
} from "../../wizards/type-guards"

describe("wizard type guards", () => {
  test("hasData/hasLang/getLang", () => {
    const state = { data: { a: 1 }, lang: "en" } as any
    expect(hasData(state)).toBe(true)
    expect(hasLang(state)).toBe(true)
    expect(getLang(state)).toBe("en")
  })

  test("hasField", () => {
    const data = { a: 1, b: undefined } as any
    expect(hasField(data, "a")).toBe(true)
    expect(hasField(data, "b")).toBe(false)
  })

  test("safeMatch/getGroup", () => {
    const match = safeMatch("abc123", /(abc)(\d+)/)
    expect(getGroup(match, 1)).toBe("abc")
    expect(getGroup(match, 2)).toBe("123")
    expect(() => safeMatch("xyz", /(abc)(\d+)/)).toThrow()
    expect(() => getGroup(match, 3)).toThrow()
  })

  test("safeState/safeData", () => {
    const state = { step: "A", data: { x: 1 } } as any
    expect(safeState(state, "step", "B")).toBe("A")
    expect(safeState(undefined, "step", "B")).toBe("B")
    expect(safeData(state, "x")).toBe(1)
    expect(safeData(undefined, "x")).toBeUndefined()
  })
})
