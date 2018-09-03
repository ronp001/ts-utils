///<reference types="jest"/>
import { StrUtils } from "../index"

test('similar', () => {
    expect(StrUtils.isSimilar('a', 'b')).toBeFalsy()
    expect(StrUtils.isSimilar('Hello', 'hello')).toBeTruthy()
    expect(StrUtils.isSimilar('Hello-There', 'hello_there')).toBeTruthy()
    expect(StrUtils.isSimilar('HELLO__THERE', 'hellothere')).toBeTruthy()
    expect(StrUtils.isSimilar('Hello There', 'hello_there')).toBeTruthy()
    expect(StrUtils.isSimilar('   Hello There  ', 'hello_there')).toBeTruthy()
    expect(StrUtils.isSimilar('Hello There!', 'hello there')).toBeFalsy()
    expect(StrUtils.isSimilar('Hello.There', 'hello there')).toBeFalsy()
    expect(StrUtils.isSimilar('Hello   There!', 'hello there')).toBeFalsy()
})