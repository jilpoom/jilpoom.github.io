---
title: Promise와 Async,Await가 혼용된 함수 리팩토링하기
description: Promise와 Async, Await는 서로 혼용될 가능성이 농후한 Javascript의 기능들이며, 이를 혼용하면 가독성을 떨어뜨릴 수 있다. 혼용할 때 오는 문제점과 이에 대한 해결점을 제시해본다.
date : '2024-02-24T16:25:00Z'
---

API 호출, Data Access, File I/O 등, 자바스크립트에서는 비동기 함수를 다룰 일이 많다. 특히 기존 레거시 코드에서 `Promise`를 사용하다가 새로 들어온 개발자가 `async/await`와 혼용하여 사용하는 경우도 흔하지 않게 볼 수 있다.
   
프로젝트 개발 전, `EsLint`과 같은 코딩 컨벤션 툴로 이를 강제할 수는 있겠지만, 만약 이에 대한 명확한 정의 없이 개발에 들어가면, 다음과 같은 코드를 작성하는게 문제가 되지 않는다.

- 비밀번호를 초기화하는 데이터 접근 함수
> 일부 공개할 수 없는 부분은 제외했다.
 ```js

const InitPassword = (user_id, hashed_password) => {
    return new Promise(async (resolve, reject) => {
        try {
            const sql = '<UPDATE QUERY>'
            
            const bind = [user_id, hashed_password];
          
            const result = await DBClient(sql, bind);
            
            if (result.affectedRows == 0)
                reject({
                    success: false,
                    message: '비밀번호 초기화 에러'
                });
            else resolve();
        } catch (error) {
            reject({
                success: false,
                message: '비밀번호 초기화 에러'
            });
        }
    });
};
```
위와 같은 코드는 문제 없이 동작한다. 가끔은 문제 없이 동작하는게 문제가 될 수 있다.
   
위의 코드의 문제점은 무엇인지 알아보기 전에 javascript에서 비동기 함수를 다루는 세 가지 방법을 왜 쓰는지 살펴보자.


# `CallBack`에서 `Promise`, `Promise`에서 `async`/`await`
자바스크립트에서 비동기 함수를 다루는 세 가지 방법의 목적은 다음과 같다.
> 난 비동기 함수를 동기 함수처럼 순서를 보장하고 싶어
비동기 함수는 병렬 처리로 시스템 자원을 효율적으로 쓸 수 있다는 장점이 있지만, 비동기 함수 요청의 결과의 순서를 보장할 수 없다는 단점이 있다. 이러한 문제를 해결하기 위해 처음 등장한 것이 `CallBack`이다.

## `CallBack`
가장 초창기의 비동기를 다루는 javascript의 기능이다.
   
그 유명한 Callback Hell(콜백 지옥)의 원인은 다음과 같이 **콜백 함수 실행 시 다음에 실행할 함수를 매개변수로 넘겨야한다**는 것이다.

```js
callback1((value) => {
  callback2((value) => {
    callback3((value) => {
      callback4((value) => {
        // 어디까지 갈거야..?
      })
    })
  })
})
```
