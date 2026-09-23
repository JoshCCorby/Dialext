# Claude Code Agent Directives

**Agent Instruction:** 
As an autonomous agent navigating our codebase, you have full license to evaluate the necessity of the tasks below. Before executing, review our architecture by cross-referencing the file named "big data apps". Run through these prompts and grade them based on their relevance to our current infrastructure. Cut and discard any useless ones that would simply waste time and tokens, and only execute the ones that provide high architectural value.

Treat these prompts as directives to audit, enforce, and build comprehensive systems based on Kleppmann’s evolvability principles, rather than generating isolated snippets.

---

## Part 1: Enforcing Evolvability

**1. Enforcing Protobuf Evolvability and CI/CD Linting**
Scan the `.proto` files in our repository. We are standardising on proto3 and must strictly enforce backward and forward compatibility for rolling upgrades. 
* First, generate a new domain event schema for `UserProfileUpdated`. Ensure all fields use unique integer tags, leverage explicit optional fields, and include enum default values. Add inline documentation explicitly warning developers that tag numbers must never be changed or reused. 
* Second, set up a `buf.yaml` configuration and add a linting script to our CI pipeline that will automatically fail the build if a field tag is altered, a required field is removed, or a field is added without a strict default. 
* Run the linter against the new schema to verify it passes.

**2. Patching the Database Read-Modify-Write Trap**
Audit our database models and deserialisation logic. We are vulnerable to the "unknown field loss trap" described in *Designing Data-Intensive Applications*. Because multiple service versions run simultaneously during deployments, older code is dropping new fields it doesn't recognise when performing read-modify-write cycles. 
* Implement a serialisation wrapper for our core models that captures any unrecognised fields into an `extra_fields` map during decoding. 
* Modify the save methods so that these unrecognised fields are merged back into the database payload upon writing. 
* Finally, write a round-trip integration test simulating an old service reading a new payload, mutating a known field, and saving it—asserting that the new fields remain entirely intact.

**3. Scaffolding Evolvable gRPC Services**
We are migrating our internal microservice communication from JSON over REST to gRPC. Review our existing REST payload structures and scaffold a new `.proto` service interface definition to replace them. 
* The network is unreliable—masking remote calls as local functions is a trap—so ensure the server request handler wrapper you generate in our target language explicitly manages asynchronous operations and partial failures. 
* Build the response message structures to guarantee forward compatibility, specifically adding optional metadata fields for future analytics. 
* Generate the server stubs and write a test demonstrating a client successfully parsing a response that contains unrecognised fields.

**4. Implementing Avro for Decoupled Message Brokers**
We are routing asynchronous traffic through our message broker and need to implement Apache Avro for our event serialisation. Since Avro relies on writer and reader schemas rather than integer tags, we need strict discipline regarding default values. 
* Generate an Avro schema for our core traffic events. You must use union types (e.g., `union { null, string }`) rather than standard optional markers to maintain compatibility. 
* Once the schema is written, create a test script that simulates a rolling upgrade: encode a payload using a newer version of this schema (with a newly added field with a default value), and decode it using an older reader schema. 
* Assert that the translation succeeds without data corruption.

---

## Part 2: Concurrency, Replication, and State

**1. Implementing Read-After-Write Consistency**
Audit our database routing tier and API request middleware. We are running a single-leader setup with asynchronous read-replicas, and users are experiencing replication lag anomalies. 
* Implement a read-after-write routing interceptor. When a user executes a write, inject a sequence token or timestamp into their session cookie. 
* For the next five seconds, force all read queries for that user's entities directly to the primary leader. Route all other reads to the follower pool. 
* Once implemented, write an integration test that simulates follower lag, ensuring the middleware correctly pins the session to the leader.

**2. Mitigating Hot Keys with Key Salting**
Review our partitioning strategy for the user activity logs table. We are vulnerable to hot spots during viral events because we partition strictly by `user_id` or `timestamp`. 
* Implement a key-salting mechanism—append a random two-digit prefix to known hot keys to distribute writes across multiple partitions. 
* Following this, write the corresponding scatter-gather read logic that queries all relevant sub-keys and merges the results. 
* Add a test suite that simulates a skewed workload to verify writes are distributed evenly.

**3. Enforcing Fencing Tokens for Distributed Locks**
Scaffold a distributed lock handler using our etcd (or ZooKeeper) client. 
* You must ensure that when a process acquires a lock lease, it extracts a monotonically increasing fencing token (`zxid` or `mod_revision`). 
* Modify our storage layer wrappers so every write request includes this token. Implement storage-side validation to reject any incoming write carrying a fencing token lower than the highest one previously observed. 
* Finally, write a test simulating a long stop-the-world GC pause where a stalled node attempts a delayed write, proving the storage layer actively rejects it.

**4. Simulating Network Partitions and Quorum Failures**
Set up a local integration test simulating a leaderless, 5-node cluster. Partition the network so two nodes are isolated. Write tests validating two distinct behaviours: 
* First, ensure strict quorum reads fail gracefully or block when they cannot reach the majority. 
* Second, implement and test a sloppy quorum fallback where isolated nodes accept local writes, store them temporarily, and execute hinted handoffs to the primary nodes once the simulated network partition is healed.

---

## Part 3: Event-Driven Architecture and Pipelines

**1. Ripping Out Dual Writes for CDC**
Audit our codebase for instances of dual writes—specifically where our application updates PostgreSQL and then makes a synchronous network call to update Elasticsearch or Redis. 
* Rip out these secondary network calls from the primary write path. We are moving to a Change Data Capture (CDC) architecture. 
* Configure Postgres logical decoding (or scaffold a Debezium connector schema) to stream WAL changes into an append-only Kafka topic. 
* Once the publisher is defined, write an asynchronous consumer service that reads this topic and applies the changes to our search index sequentially. Ensure the consumer implements idempotency to handle message redelivery safely.

**2. Building a Self-Healing CQRS Projector**
We need to build a CQRS read-model projector. Write a Kafka consumer loop that subscribes to our log-compacted database changelog topic. 
* The critical requirement is state hydration: implement a startup handler that detects if the local read-model (e.g., our Redis cache or local search index) is empty or corrupted. If it is, the consumer must seek to offset 0 and replay the entire log-compacted topic to rebuild the current state from scratch. 
* Ensure the consumer logic correctly processes tombstone messages to delete defunct records. 
* Finally, write an integration test verifying that an empty cache can fully rebuild itself from the Kafka stream without executing a single read query against the primary database.

**3. Scaffolding an Event-Sourcing Command Engine**
Implement an event-sourcing handler for our order management domain. You must strictly separate Commands from Events. 
* Write the Command handlers to act synchronously—they must validate business rules, check inventory, and reject invalid requests before any state changes. 
* If a Command succeeds, it must yield an immutable Event (e.g., `OrderPlaced`, `ReservationCancelled`) that is appended to our event log. 
* Next, write the projection logic that integrates these historical events into the current state. Add structural safeguards and inline documentation ensuring that once an event is written to the log, downstream consumers treat it as an indisputable fact and never attempt to reject it.